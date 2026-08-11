import { and, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import {
    type CodebergSyncRepo,
    getAuthenticatedUserRepos as getCodebergAuthenticatedUserRepos,
    getReposByOwner as getCodebergReposByOwner,
    getUser as getCodebergUser,
    getUserByUsername as getCodebergUserByUsername,
    getUserOrgs as getCodebergUserOrgs,
    isOrg as isCodebergOrg,
} from "~/server/codeberg";
import * as schema from "~/server/db/schema";
import {
    type GitHubSyncRepo,
    getAuthenticatedUser,
    getOwnerProfile,
    listAuthenticatedUserOrgMemberships,
    listAuthenticatedUserRepos,
    listAuthenticatedUserTeams,
    listReposForOwner,
    listTeamRepos,
} from "~/server/github";

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

type Db = NodePgDatabase<typeof schema>;

// Insert/delete are the only operations the write helpers need, which lets
// them run against either the database or a transaction.
type Executor = Pick<Db, "insert" | "delete">;

type SyncRepo = {
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

type RelationRow = {
    resourceType: string;
    resourceId: number;
    relation: RelationName;
    subjectType: string;
    subjectId: number;
};

/** GitHub permission flags -> relation vocabulary used by the permission view. */
export function githubRepoPermissionsToRelation(
    permissions: RepoPermission,
): "admin" | "maintainer" | "writer" | "triager" | "reader" | null {
    if (permissions.admin) return "admin";
    if (permissions.maintain) return "maintainer";
    if (permissions.push) return "writer";
    if (permissions.triage) return "triager";
    if (permissions.pull) return "reader";
    return null;
}

/** Codeberg permission flags -> relation vocabulary used by the permission view. */
export function codebergRepoPermissionsToRelation(
    permissions: Pick<RepoPermission, "admin" | "push" | "pull">,
): "admin" | "writer" | "reader" | null {
    if (permissions.admin) return "admin";
    if (permissions.push) return "writer";
    if (permissions.pull) return "reader";
    return null;
}

function toSyncRepo(
    repo: CodebergSyncRepo,
    ownerType: "user" | "org",
): SyncRepo {
    return {
        providerId: repo.providerId,
        name: repo.name,
        owner: { ...repo.owner, type: ownerType },
        permissions: repo.permissions
            ? {
                  admin: repo.permissions.admin,
                  maintain: false,
                  push: repo.permissions.push,
                  triage: false,
                  pull: repo.permissions.pull,
              }
            : null,
        rawData: repo.rawData,
    };
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

async function insertRelations(
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

async function deleteRelationsForSubject(
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

/**
 * Sync-scoped upsert helpers. Caches account/repo ids by provider id so
 * repeated encounters of the same entity (e.g. a repo owner appearing in many
 * repos) only hit the database once per sync.
 */
function createSyncContext(
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

const newResult = (): SyncResult => ({
    accountsUpserted: 0,
    reposUpserted: 0,
    relationsWritten: 0,
    relationsRemoved: 0,
    teamsSkipped: 0,
});

/**
 * Upserts the account row for `owner` plus every repository it owns.
 * Refreshes the permission view afterwards.
 */
export async function refreshOwnerRepos(
    db: Db,
    input: { provider: SyncProvider; owner: string; accessToken: string },
): Promise<SyncResult> {
    const result = newResult();

    let owner: {
        providerId: number;
        login: string;
        avatarUrl: string | null;
        type: "user" | "org";
    };
    let repos: SyncRepo[];

    if (input.provider === "github") {
        owner = await getOwnerProfile(input.accessToken, input.owner);
        const raw = await listReposForOwner(
            input.accessToken,
            input.owner,
            owner.type,
        );
        repos = raw;
    } else {
        const profile = await getCodebergUserByUsername(
            input.accessToken,
            input.owner,
        );
        if (!profile) {
            throw new Error(`Codeberg account "${input.owner}" not found`);
        }
        owner = {
            providerId: profile.id,
            login: profile.login,
            avatarUrl: profile.avatar_url ?? null,
            type: (await isCodebergOrg(input.owner, input.accessToken))
                ? "org"
                : "user",
        };
        const raw = await getCodebergReposByOwner(
            input.owner,
            input.accessToken,
        );
        repos = raw.map((repo) => toSyncRepo(repo, owner.type));
    }

    await db.transaction(async (tx) => {
        const ctx = createSyncContext(tx, input.provider, result);
        await ctx.ensureAccount(owner);
        for (const repo of repos) {
            await ctx.ensureRepo(repo);
        }
    });

    await refreshPermissionsView(db);
    return result;
}

/**
 * Refreshes the current user's account row, organization/team memberships,
 * and repository grants so mv_user_repo_permissions reflects their current
 * effective permissions. Direct grants always cover the user's own access;
 * team-level grants additionally model the shared team edges.
 */
export async function syncCurrentUser(
    db: Db,
    input: { provider: SyncProvider; accessToken: string },
): Promise<SyncResult> {
    if (input.provider === "github") {
        return syncCurrentUserGitHub(db, input.accessToken);
    }
    return syncCurrentUserCodeberg(db, input.accessToken);
}

async function syncCurrentUserGitHub(
    db: Db,
    accessToken: string,
): Promise<SyncResult> {
    const result = newResult();
    const profile = await getAuthenticatedUser(accessToken);

    // Fetch everything up front so the transaction below only does writes.
    const repos = await listAuthenticatedUserRepos(accessToken);
    const memberships = await listAuthenticatedUserOrgMemberships(accessToken);
    const teams = await listAuthenticatedUserTeams(accessToken);

    // Team repo grants need one GraphQL call per team; a failing team only
    // skips its shared edges (direct grants above still cover the user).
    const teamRepos = new Map<number, GitHubSyncRepo[]>();
    await Promise.all(
        teams.map(async (team) => {
            try {
                teamRepos.set(
                    team.providerId,
                    await listTeamRepos(accessToken, team.org.login, team.slug),
                );
            } catch {
                result.teamsSkipped++;
            }
        }),
    );

    const relations: RelationRow[] = [];
    const teamIds: number[] = [];

    await db.transaction(async (tx) => {
        const ctx = createSyncContext(tx, "github", result);
        const userAccountId = await ctx.ensureAccount({
            providerId: profile.id,
            login: profile.login,
            avatarUrl: profile.avatar_url ?? null,
            type: "user",
        });

        for (const repo of repos) {
            const repoId = await ctx.ensureRepo(repo);
            // Personal repos already grant admin via mv_user_repo_permissions.
            if (repo.owner.login === profile.login) continue;
            if (!repo.permissions) continue;
            const relation = githubRepoPermissionsToRelation(repo.permissions);
            if (!relation) continue;
            relations.push({
                resourceType: "repo",
                resourceId: repoId,
                relation,
                subjectType: "user",
                subjectId: userAccountId,
            });
        }

        for (const membership of memberships) {
            const orgAccountId = await ctx.ensureAccount({
                providerId: membership.providerId,
                login: membership.login,
                avatarUrl: membership.avatarUrl,
                type: "org",
            });
            relations.push({
                resourceType: "org",
                resourceId: orgAccountId,
                relation: membership.role,
                subjectType: "user",
                subjectId: userAccountId,
            });
        }

        for (const team of teams) {
            const orgAccountId = await ctx.ensureAccount({
                providerId: team.org.providerId,
                login: team.org.login,
                avatarUrl: team.org.avatarUrl,
                type: "org",
            });
            teamIds.push(team.providerId);
            relations.push({
                resourceType: "team",
                resourceId: team.providerId,
                relation: "member",
                subjectType: "user",
                subjectId: userAccountId,
            });
            relations.push({
                resourceType: "org",
                resourceId: orgAccountId,
                relation: "member",
                subjectType: "team",
                subjectId: team.providerId,
            });
            for (const repo of teamRepos.get(team.providerId) ?? []) {
                const repoId = await ctx.ensureRepo(repo);
                if (!repo.permissions) continue;
                const relation = githubRepoPermissionsToRelation(
                    repo.permissions,
                );
                if (!relation) continue;
                relations.push({
                    resourceType: "repo",
                    resourceId: repoId,
                    relation,
                    subjectType: "team",
                    subjectId: team.providerId,
                });
            }
        }

        // Replace this user's rows with the freshly fetched state.
        result.relationsRemoved += await deleteRelationsForSubject(tx, "user", [
            userAccountId,
        ]);
        if (teamIds.length > 0) {
            result.relationsRemoved += await deleteRelationsForSubject(
                tx,
                "team",
                teamIds,
            );
        }
        result.relationsWritten += await insertRelations(tx, relations);
    });

    await refreshPermissionsView(db);
    return result;
}

async function syncCurrentUserCodeberg(
    db: Db,
    accessToken: string,
): Promise<SyncResult> {
    const result = newResult();
    const profile = await getCodebergUser(accessToken);
    if (!profile) {
        throw new Error("Failed to fetch Codeberg profile");
    }

    const orgs = await getCodebergUserOrgs(accessToken);
    const orgIds = new Set(orgs.map((org) => org.providerId));
    const rawRepos = await getCodebergAuthenticatedUserRepos(accessToken);
    const repos = rawRepos.map((repo) =>
        toSyncRepo(repo, orgIds.has(repo.owner.providerId) ? "org" : "user"),
    );

    const relations: RelationRow[] = [];

    await db.transaction(async (tx) => {
        const ctx = createSyncContext(tx, "codeberg", result);
        const userAccountId = await ctx.ensureAccount({
            providerId: profile.id,
            login: profile.login,
            avatarUrl: profile.avatar_url ?? null,
            type: "user",
        });

        for (const repo of repos) {
            const repoId = await ctx.ensureRepo(repo);
            // Personal repos already grant admin via mv_user_repo_permissions.
            if (repo.owner.login === profile.login) continue;
            if (!repo.permissions) continue;
            const relation = codebergRepoPermissionsToRelation(
                repo.permissions,
            );
            if (!relation) continue;
            relations.push({
                resourceType: "repo",
                resourceId: repoId,
                relation,
                subjectType: "user",
                subjectId: userAccountId,
            });
        }

        // Forgejo does not expose org membership roles, so every membership is
        // recorded as "member"; the permission view expands it regardless.
        for (const org of orgs) {
            const orgAccountId = await ctx.ensureAccount({
                providerId: org.providerId,
                login: org.login,
                avatarUrl: org.avatarUrl,
                type: "org",
            });
            relations.push({
                resourceType: "org",
                resourceId: orgAccountId,
                relation: "member",
                subjectType: "user",
                subjectId: userAccountId,
            });
        }

        result.relationsRemoved += await deleteRelationsForSubject(tx, "user", [
            userAccountId,
        ]);
        result.relationsWritten += await insertRelations(tx, relations);
    });

    await refreshPermissionsView(db);
    return result;
}
