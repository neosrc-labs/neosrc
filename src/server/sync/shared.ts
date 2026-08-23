import { createHash } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "~/server/db/schema";

export type SyncProvider = "github" | "codeberg";

/** Canonical repo visibility; more states (e.g. internal) may be added. */
export type RepoVisibility = "private" | "public";

/** Relation vocabulary understood by mv_user_repo_permissions. */
export type RelationName =
    | "owner"
    | "admin"
    | "maintainer"
    | "writer"
    | "triager"
    | "reader"
    | "member";

export type RepoPermission = {
    admin: boolean;
    maintain: boolean;
    push: boolean;
    triage: boolean;
    pull: boolean;
};

export type SyncResult = {
    accountsUpserted: number;
    reposUpserted: number;
    relationsWritten: number;
    relationsRemoved: number;
    teamsSkipped: number;
};

/** Last-applied permission sync for a user's provider, from the permissions_sync_state table. */
export type StoredSyncState = {
    snapshotHash: string;
    updatedAt: Date;
    /** When the stored snapshot was read from the provider; null pre-migration. */
    snapshotFetchedAt: Date | null;
};

export type Db = NodePgDatabase<typeof schema>;

// Insert/delete/select are the only operations these helpers need, which lets
// them run against either the database or a transaction.
export type Executor = Pick<Db, "insert" | "delete" | "select">;

export type SyncRepo = {
    providerId: number;
    name: string;
    visibility: RepoVisibility;
    description: string | null;
    stars: number;
    watchers: number;
    forks: number;
    defaultBranch: string | null;
    archived: boolean;
    owner: {
        providerId: number;
        login: string;
        avatarUrl: string | null;
        type: "user" | "org";
    };
    permissions: RepoPermission | null;
    rawData: unknown;
};

export type RelationRow = {
    resourceType: string;
    resourceId: number;
    relation: RelationName;
    subjectType: string;
    subjectId: number;
};

/** Id-caching upsert helpers handed to provider relation builders. */
export type SyncContext = {
    ensureAccount: (account: {
        providerId: number;
        login: string;
        avatarUrl: string | null;
        type: "user" | "org";
    }) => Promise<number>;
    ensureRepo: (repo: SyncRepo) => Promise<number>;
};

/**
 * Sync-scoped upsert helpers. Caches account/repo ids by provider id so
 * repeated encounters of the same entity (e.g. a repo owner appearing in many
 * repos) only hit the database once per sync.
 */
export function createSyncContext(
    executor: Executor,
    provider: SyncProvider,
    result: SyncResult,
): SyncContext {
    const accountIds = new Map<number, number>();
    const repoIds = new Map<number, number>();

    const ensureAccount = async (account: {
        providerId: number;
        login: string;
        avatarUrl: string | null;
        type: "user" | "org";
    }): Promise<number> => {
        const cached = accountIds.get(account.providerId);
        if (cached !== undefined) return cached;
        const id = await upsertAccount(executor, {
            provider,
            providerId: account.providerId,
            username: account.login,
            type: account.type,
            avatarUrl: account.avatarUrl,
        });
        accountIds.set(account.providerId, id);
        result.accountsUpserted++;
        return id;
    };

    const ensureRepo = async (repo: SyncRepo): Promise<number> => {
        const cached = repoIds.get(repo.providerId);
        if (cached !== undefined) return cached;
        const ownerAccountId = await ensureAccount(repo.owner);
        const id = await upsertRepo(executor, {
            provider,
            providerId: repo.providerId,
            name: repo.name,
            visibility: repo.visibility,
            description: repo.description,
            stars: repo.stars,
            watchers: repo.watchers,
            forks: repo.forks,
            defaultBranch: repo.defaultBranch,
            archived: repo.archived,
            accountId: ownerAccountId,
            rawData: repo.rawData,
        });
        repoIds.set(repo.providerId, id);
        result.reposUpserted++;
        return id;
    };

    return { ensureAccount, ensureRepo };
}

export async function upsertAccount(
    executor: Executor,
    input: {
        provider: SyncProvider;
        providerId: number;
        username: string;
        type: "user" | "org";
        avatarUrl: string | null;
    },
): Promise<number> {
    const [row] = await executor
        .insert(schema.account)
        .values({
            provider: input.provider,
            providerId: input.providerId,
            username: input.username,
            type: input.type,
            avatarUrl: input.avatarUrl,
        })
        .onConflictDoUpdate({
            target: [schema.account.provider, schema.account.providerId],
            set: {
                username: input.username,
                type: input.type,
                avatarUrl: input.avatarUrl,
                updatedAt: new Date(),
            },
        })
        .returning({ id: schema.account.id });
    if (!row) {
        throw new Error("Account upsert returned no row");
    }
    return row.id;
}

export async function upsertRepo(
    executor: Executor,
    input: {
        provider: SyncProvider;
        providerId: number;
        name: string;
        visibility: RepoVisibility;
        description: string | null;
        stars: number;
        watchers: number;
        forks: number;
        defaultBranch: string | null;
        archived: boolean;
        accountId: number;
        rawData: unknown;
    },
): Promise<number> {
    const lastSynced = new Date();
    const [row] = await executor
        .insert(schema.repo)
        .values({
            provider: input.provider,
            providerId: input.providerId,
            name: input.name,
            visibility: input.visibility,
            description: input.description,
            stars: input.stars,
            watchers: input.watchers,
            forks: input.forks,
            defaultBranch: input.defaultBranch,
            archived: input.archived,
            accountId: input.accountId,
            rawData: input.rawData,
            lastSynced,
        })
        .onConflictDoUpdate({
            target: [schema.repo.provider, schema.repo.providerId],
            set: {
                name: input.name,
                visibility: input.visibility,
                description: input.description,
                stars: input.stars,
                watchers: input.watchers,
                forks: input.forks,
                defaultBranch: input.defaultBranch,
                archived: input.archived,
                accountId: input.accountId,
                rawData: input.rawData,
                lastSynced,
                updatedAt: new Date(),
            },
        })
        .returning({ id: schema.repo.id });
    if (!row) {
        throw new Error("Repo upsert returned no row");
    }
    return row.id;
}

export async function insertRelations(
    executor: Executor,
    rows: RelationRow[],
): Promise<number> {
    if (rows.length === 0) return 0;
    const inserted = await executor
        .insert(schema.relation)
        .values(rows)
        .onConflictDoNothing({
            target: [
                schema.relation.resourceType,
                schema.relation.resourceId,
                schema.relation.relation,
                schema.relation.subjectType,
                schema.relation.subjectId,
            ],
        })
        .returning({ id: schema.relation.id });
    return inserted.length;
}

export async function deleteRelationsForSubject(
    executor: Executor,
    subjectType: string,
    subjectIds: number[],
    resourceType?: string,
): Promise<number> {
    const conditions = [
        eq(schema.relation.subjectType, subjectType),
        inArray(schema.relation.subjectId, subjectIds),
    ];
    if (resourceType) {
        conditions.push(eq(schema.relation.resourceType, resourceType));
    }
    const deleted = await executor
        .delete(schema.relation)
        .where(and(...conditions))
        .returning({ id: schema.relation.id });
    return deleted.length;
}

/**
 * Rebuilds mv_user_repo_permissions so lookups reflect the latest
 * account/repo/relation rows. Requires the unique index on the view.
 */
export async function refreshPermissionsView(db: Db): Promise<void> {
    await db.execute(
        sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_repo_permissions`,
    );
}

export const newResult = (): SyncResult => ({
    accountsUpserted: 0,
    reposUpserted: 0,
    relationsWritten: 0,
    relationsRemoved: 0,
    teamsSkipped: 0,
});

/**
 * Stable signature of a permission snapshot. Callers build a canonical,
 * order-insensitive payload (sorted arrays, fixed key order) so equal
 * permission states always hash identically regardless of API pagination or
 * ordering.
 */
export function hashSnapshot(payload: unknown): string {
    return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/** Syncs applied within this window are considered fresh and skipped entirely. */
export const SYNC_RECENCY_WINDOW_MS = 5 * 60 * 1000;

/** True when the stored sync is fresh enough to skip re-fetching the inputs. */
export function isSyncStateFresh(
    updatedAt: Date,
    now: Date = new Date(),
): boolean {
    return now.getTime() - updatedAt.getTime() < SYNC_RECENCY_WINDOW_MS;
}

/** Last-applied snapshot state for a user's provider sync, if any. */
export async function getStoredSyncState(
    db: Executor,
    provider: SyncProvider,
    userId: string,
): Promise<StoredSyncState | null> {
    // Callers use this both for the unlocked recency/hash gate (a stale read
    // there only causes one redundant re-sync) and for the ordering guard read
    // taken while holding the per-user advisory lock.
    const [row] = await db
        .select({
            snapshotHash: schema.permissionsSyncState.snapshotHash,
            updatedAt: schema.permissionsSyncState.updatedAt,
            snapshotFetchedAt: schema.permissionsSyncState.snapshotFetchedAt,
        })
        .from(schema.permissionsSyncState)
        .where(
            and(
                eq(schema.permissionsSyncState.provider, provider),
                eq(schema.permissionsSyncState.userId, userId),
            ),
        )
        .limit(1);
    return row ?? null;
}

/** Records the applied snapshot hash for a user's provider sync. */
export async function storeSyncState(
    db: Executor,
    provider: SyncProvider,
    userId: string,
    snapshotHash: string,
    snapshotFetchedAt: Date,
): Promise<void> {
    await db
        .insert(schema.permissionsSyncState)
        .values({
            provider,
            userId,
            snapshotHash,
            snapshotFetchedAt,
            updatedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: [
                schema.permissionsSyncState.provider,
                schema.permissionsSyncState.userId,
            ],
            set: {
                snapshotHash,
                snapshotFetchedAt,
                updatedAt: new Date(),
            },
        });
}

export type PermissionSyncInput = {
    accessToken: string;
    userId: string;
    forceRecent: boolean;
    forceFull: boolean;
};

/** Provider-agnostic parts of the snapshot a permission sync applies. */
export type PermissionSyncSnapshot = {
    /** Authenticated user whose own rows are rebuilt. */
    user: { providerId: number; login: string; avatarUrl: string | null };
    snapshotHash: string;
};

/**
 * Relations a provider builds under the advisory lock, plus the subject
 * groups the rebuild replaces and whether the snapshot was fetched whole.
 */
export type RelationPlan = {
    relations: RelationRow[];
    /**
     * Extra subject groups whose stale rows are deleted before `relations`
     * is inserted. Only applied when `complete` is true.
     */
    subjectGroups?: { subjectType: string; subjectIds: number[] }[];
    /** False when part of the snapshot failed to fetch. */
    complete: boolean;
};

/**
 * Provider steps of runPermissionSync. Fetch loops stay provider-side so each
 * provider keeps its own API shape, pagination, and rate-limit strategy; the
 * template owns everything from the recency gate to the view refresh.
 */
export type PermissionSyncHooks<Snapshot extends PermissionSyncSnapshot> = {
    /** Fetches the snapshot inputs and computes the snapshot hash. */
    loadSnapshot: (
        accessToken: string,
        result: SyncResult,
    ) => Promise<Snapshot>;
    /** Builds the relation rows applied under the advisory lock. */
    buildRelations: (
        ctx: SyncContext,
        result: SyncResult,
        snapshot: Snapshot,
        userAccountId: number,
    ) => Promise<RelationPlan>;
};

/**
 * Template for the incremental current-user permission sync both providers
 * share: recency gate, snapshot hash gate, advisory lock, stale-snapshot
 * guard, delete-then-insert replace, and materialized-view refresh.
 *
 * An incomplete snapshot (`RelationPlan.complete === false`) keeps existing
 * rows for the conditional subject groups and leaves the sync state unstored,
 * so the next poll retries instead of matching the partial hash.
 */
export async function runPermissionSync<
    Snapshot extends PermissionSyncSnapshot,
>(
    db: Db,
    provider: SyncProvider,
    input: PermissionSyncInput,
    hooks: PermissionSyncHooks<Snapshot>,
): Promise<SyncResult> {
    const result = newResult();

    // Recency gate: skip fetching the snapshot inputs entirely when the last
    // applied sync is fresh, unless forced.
    const stored = await getStoredSyncState(db, provider, input.userId);
    if (
        !input.forceRecent &&
        !input.forceFull &&
        stored !== null &&
        isSyncStateFresh(stored.updatedAt)
    ) {
        return result;
    }

    // Snapshot ordering token: captured before the provider reads so the guard
    // under the advisory lock can reject a snapshot older than the applied one.
    const snapshotFetchedAt = new Date();

    const snapshot = await hooks.loadSnapshot(input.accessToken, result);
    if (!input.forceFull && stored?.snapshotHash === snapshot.snapshotHash) {
        return result;
    }

    let didApply = false;
    await db.transaction(async (tx) => {
        // Serialize overlapping syncs for the same user/provider: the
        // delete-then-insert replace below is not idempotent under overlap,
        // and without the lock a stale snapshot could commit last and leave
        // revoked grants visible past the hash gate.
        await tx.execute(
            sql`SELECT pg_advisory_xact_lock(hashtext(${provider}), hashtext(${input.userId}))`,
        );
        // Refuse to apply a snapshot older than the one already committed
        // under this lock; otherwise an older concurrent sync could restore
        // grants a newer sync just removed.
        const applied = await getStoredSyncState(tx, provider, input.userId);
        if (
            applied?.snapshotFetchedAt &&
            applied.snapshotFetchedAt.getTime() > snapshotFetchedAt.getTime()
        ) {
            return;
        }
        const ctx = createSyncContext(tx, provider, result);
        const userAccountId = await ctx.ensureAccount({
            ...snapshot.user,
            type: "user",
        });
        const plan = await hooks.buildRelations(
            ctx,
            result,
            snapshot,
            userAccountId,
        );

        // Replace this user's rows with the freshly fetched state.
        result.relationsRemoved += await deleteRelationsForSubject(tx, "user", [
            userAccountId,
        ]);
        for (const group of plan.subjectGroups ?? []) {
            if (!plan.complete || group.subjectIds.length === 0) continue;
            result.relationsRemoved += await deleteRelationsForSubject(
                tx,
                group.subjectType,
                group.subjectIds,
            );
        }
        result.relationsWritten += await insertRelations(tx, plan.relations);
        if (plan.complete) {
            await storeSyncState(
                tx,
                provider,
                input.userId,
                snapshot.snapshotHash,
                snapshotFetchedAt,
            );
        }
        didApply = true;
    });

    if (didApply) await refreshPermissionsView(db);
    return result;
}
