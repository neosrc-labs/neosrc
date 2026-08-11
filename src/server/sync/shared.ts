import { createHash } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "~/server/db/schema";

export type SyncProvider = "github" | "codeberg";

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
};

export type Db = NodePgDatabase<typeof schema>;

// Insert/delete are the only operations the write helpers need, which lets
// them run against either the database or a transaction.
export type Executor = Pick<Db, "insert" | "delete">;

export type SyncRepo = {
    providerId: number;
    name: string;
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

/**
 * Sync-scoped upsert helpers. Caches account/repo ids by provider id so
 * repeated encounters of the same entity (e.g. a repo owner appearing in many
 * repos) only hit the database once per sync.
 */
export function createSyncContext(
    executor: Executor,
    provider: SyncProvider,
    result: SyncResult,
) {
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
            accountId: ownerAccountId,
            rawData: repo.rawData,
        });
        repoIds.set(repo.providerId, id);
        result.reposUpserted++;
        return id;
    };

    return { ensureAccount, ensureRepo };
}

async function upsertAccount(
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

async function upsertRepo(
    executor: Executor,
    input: {
        provider: SyncProvider;
        providerId: number;
        name: string;
        accountId: number;
        rawData: unknown;
    },
): Promise<number> {
    const [row] = await executor
        .insert(schema.repo)
        .values({
            provider: input.provider,
            providerId: input.providerId,
            name: input.name,
            accountId: input.accountId,
            rawData: input.rawData,
        })
        .onConflictDoUpdate({
            target: [schema.repo.provider, schema.repo.providerId],
            set: {
                name: input.name,
                accountId: input.accountId,
                rawData: input.rawData,
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
    db: Db,
    provider: SyncProvider,
    userId: string,
): Promise<StoredSyncState | null> {
    const [row] = await db
        .select({
            snapshotHash: schema.permissionsSyncState.snapshotHash,
            updatedAt: schema.permissionsSyncState.updatedAt,
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
    db: Db,
    provider: SyncProvider,
    userId: string,
    snapshotHash: string,
): Promise<void> {
    await db
        .insert(schema.permissionsSyncState)
        .values({
            provider,
            userId,
            snapshotHash,
            updatedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: [
                schema.permissionsSyncState.provider,
                schema.permissionsSyncState.userId,
            ],
            set: {
                snapshotHash,
                updatedAt: new Date(),
            },
        });
}
