import {
    CODEBERG_API,
    getUser as getCodebergUser,
    getUserByUsername as getCodebergUserByUsername,
} from "~/server/codeberg";
import type {
    Db,
    RelationRow,
    RepoPermission,
    RepoVisibility,
    SyncRepo,
    SyncResult,
} from "./shared";
import {
    createSyncContext,
    deleteRelationsForSubject,
    getStoredSyncState,
    hashSnapshot,
    insertRelations,
    isSyncStateFresh,
    newResult,
    refreshPermissionsView,
    storeSyncState,
} from "./shared";

export type CodebergSyncRepo = {
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
    };
    permissions: {
        admin: boolean;
        push: boolean;
        pull: boolean;
    } | null;
    /** Raw REST API payload for the repository. */
    rawData: unknown;
};

type CodebergRepoResponse = {
    id: number;
    name: string;
    private: boolean;
    description: string | null;
    stars_count: number;
    watchers_count: number;
    forks_count: number;
    default_branch: string | null;
    archived: boolean;
    owner: {
        id: number;
        login: string;
        avatar_url?: string | null;
    };
    permissions?: {
        admin: boolean;
        push: boolean;
        pull: boolean;
    } | null;
};

/**
 * Upserts the account row for `owner` plus every repository it owns.
 * Refreshes the permission view afterwards.
 */
export async function fetchOwnerRepos(
    accessToken: string,
    owner: string,
): Promise<{
    owner: {
        providerId: number;
        login: string;
        avatarUrl: string | null;
        type: "user" | "org";
    };
    repos: SyncRepo[];
}> {
    const profile = await getCodebergUserByUsername(accessToken, owner);
    if (!profile) {
        throw new Error(`Codeberg account "${owner}" not found`);
    }
    const type = (await isOrg(owner, accessToken)) ? "org" : "user";
    const raw = await getReposByOwner(owner, accessToken);
    return {
        owner: {
            providerId: profile.id,
            login: profile.login,
            avatarUrl: profile.avatar_url ?? null,
            type,
        },
        repos: raw.map((repo) => toSyncRepo(repo, type)),
    };
}

/**
 * Refreshes the current user's account row, organization memberships, and
 * repository grants so mv_user_repo_permissions reflects their current
 * effective permissions.
 *
 * Incremental: the permission snapshot is hashed and compared to the last
 * applied hash; when nothing changed, no rows are written and the
 * materialized view is left alone. When the last applied sync is under
 * `SYNC_RECENCY_WINDOW_MS` old, the inputs are not even fetched.
 * `forceRecent` bypasses only the recency gate, `forceFull` re-syncs
 * unconditionally.
 */
export async function syncCurrentUserCodeberg(
    db: Db,
    input: {
        accessToken: string;
        userId: string;
        forceRecent: boolean;
        forceFull: boolean;
    },
): Promise<SyncResult> {
    const result = newResult();

    // Recency gate: skip fetching the snapshot inputs entirely when the last
    // applied sync is fresh, unless forced.
    const stored = await getStoredSyncState(db, "codeberg", input.userId);
    if (
        !input.forceRecent &&
        !input.forceFull &&
        stored !== null &&
        isSyncStateFresh(stored.updatedAt)
    ) {
        return result;
    }

    const profile = await getCodebergUser(input.accessToken);
    if (!profile) {
        throw new Error("Failed to fetch Codeberg profile");
    }

    const orgs = await getUserOrgs(input.accessToken);
    const orgIds = new Set(orgs.map((org) => org.providerId));
    const rawRepos = await getAuthenticatedUserRepos(input.accessToken);
    const repos = rawRepos.map((repo) =>
        toSyncRepo(repo, orgIds.has(repo.owner.providerId) ? "org" : "user"),
    );

    const snapshotHash = codebergSnapshotHash(repos, orgs);
    if (!input.forceFull && stored?.snapshotHash === snapshotHash) {
        return result;
    }

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
    await storeSyncState(db, "codeberg", input.userId, snapshotHash);
    return result;
}

/**
 * Order-insensitive signature of the permission snapshot: repo ids with their
 * permission flags and the org memberships.
 */
export function codebergSnapshotHash(
    repos: SyncRepo[],
    orgs: { providerId: number }[],
): string {
    return hashSnapshot({
        repos: repos
            .map((repo) => ({
                id: repo.providerId,
                permissions: repo.permissions,
            }))
            .sort((a, b) => a.id - b.id),
        orgs: orgs.map((org) => org.providerId).sort((a, b) => a - b),
    });
}

/** Repositories owned by a user or organization. */
export async function getReposByOwner(
    username: string,
    accessToken?: string,
): Promise<CodebergSyncRepo[]> {
    const results: CodebergSyncRepo[] = [];
    let page = 1;
    const limit = 100;
    for (;;) {
        const data = await fetchCodebergJson<CodebergRepoResponse[]>(
            `/api/v1/users/${username}/repos?limit=${limit}&page=${page}`,
            accessToken,
        );
        if (!data || data.length === 0) break;
        for (const repo of data) results.push(toCodebergSyncRepo(repo));
        if (data.length < limit) break;
        page++;
    }
    return results;
}

/** True when the username belongs to an organization. */
export async function isOrg(
    username: string,
    accessToken?: string,
): Promise<boolean> {
    const res = await fetch(`${CODEBERG_API}/api/v1/orgs/${username}`, {
        headers: accessToken
            ? {
                  Authorization: `token ${accessToken}`,
                  Accept: "application/json",
              }
            : { Accept: "application/json" },
    });
    return res.ok;
}

/**
 * Repositories the authenticated user owns or has access to, with the
 * effective permission level per repository.
 */
export async function getAuthenticatedUserRepos(
    accessToken: string,
): Promise<CodebergSyncRepo[]> {
    const results: CodebergSyncRepo[] = [];
    let page = 1;
    const limit = 100;
    for (;;) {
        const data = await fetchCodebergJson<CodebergRepoResponse[]>(
            `/api/v1/user/repos?limit=${limit}&page=${page}`,
            accessToken,
        );
        if (!data || data.length === 0) break;
        for (const repo of data) results.push(toCodebergSyncRepo(repo));
        if (data.length < limit) break;
        page++;
    }
    return results;
}

/** Organizations the authenticated user belongs to. */
export async function getUserOrgs(
    accessToken: string,
): Promise<{ providerId: number; login: string; avatarUrl: string | null }[]> {
    const data = await fetchCodebergJson<
        Array<{
            id: number;
            username: string;
            avatar_url?: string | null;
        }>
    >("/api/v1/user/orgs", accessToken);
    if (!data) return [];
    return data.map((org) => ({
        providerId: org.id,
        login: org.username,
        avatarUrl: org.avatar_url ?? null,
    }));
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

async function fetchCodebergJson<T>(
    path: string,
    accessToken?: string,
): Promise<T | null> {
    const res = await fetch(`${CODEBERG_API}${path}`, {
        headers: accessToken
            ? {
                  Authorization: `token ${accessToken}`,
                  Accept: "application/json",
              }
            : { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
}

function toCodebergSyncRepo(repo: CodebergRepoResponse): CodebergSyncRepo {
    return {
        providerId: repo.id,
        name: repo.name,
        visibility: repo.private ? "private" : "public",
        description: repo.description,
        stars: repo.stars_count,
        watchers: repo.watchers_count,
        forks: repo.forks_count,
        defaultBranch: repo.default_branch,
        archived: repo.archived,
        owner: {
            providerId: repo.owner.id,
            login: repo.owner.login,
            avatarUrl: repo.owner.avatar_url ?? null,
        },
        permissions: repo.permissions
            ? {
                  admin: repo.permissions.admin,
                  push: repo.permissions.push,
                  pull: repo.permissions.pull,
              }
            : null,
        rawData: repo,
    };
}

function toSyncRepo(
    repo: CodebergSyncRepo,
    ownerType: "user" | "org",
): SyncRepo {
    return {
        providerId: repo.providerId,
        name: repo.name,
        visibility: repo.visibility,
        description: repo.description,
        stars: repo.stars,
        watchers: repo.watchers,
        forks: repo.forks,
        defaultBranch: repo.defaultBranch,
        archived: repo.archived,
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
