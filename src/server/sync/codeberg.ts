import {
    CODEBERG_API,
    getUser as getCodebergUser,
    getUserByUsername as getCodebergUserByUsername,
} from "~/server/codeberg";
import { type CodebergRepoRaw, codebergRepoToSyncRepo } from "./mappers";
import type {
    Db,
    PermissionSyncInput,
    PermissionSyncSnapshot,
    RelationRow,
    RepoPermission,
    SyncRepo,
    SyncResult,
} from "./shared";
import { hashSnapshot, runPermissionSync } from "./shared";

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
        repos: raw.map((repo) => codebergRepoToSyncRepo(repo, type)),
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
type CodebergSnapshot = PermissionSyncSnapshot & {
    repos: SyncRepo[];
    orgs: { providerId: number; login: string; avatarUrl: string | null }[];
};

export async function syncCurrentUserCodeberg(
    db: Db,
    input: PermissionSyncInput,
): Promise<SyncResult> {
    return runPermissionSync(db, "codeberg", input, {
        async loadSnapshot(accessToken): Promise<CodebergSnapshot> {
            const profile = await getCodebergUser(accessToken);
            if (!profile) {
                throw new Error("Failed to fetch Codeberg profile");
            }

            const orgs = await getUserOrgs(accessToken);
            const orgIds = new Set(orgs.map((org) => org.providerId));
            const rawRepos = await getAuthenticatedUserRepos(accessToken);
            const repos = rawRepos.map((repo) =>
                codebergRepoToSyncRepo(
                    repo,
                    orgIds.has(repo.owner.id) ? "org" : "user",
                ),
            );

            return {
                user: {
                    providerId: profile.id,
                    login: profile.login,
                    avatarUrl: profile.avatar_url ?? null,
                },
                repos,
                orgs,
                snapshotHash: codebergSnapshotHash(repos, orgs),
            };
        },
        async buildRelations(ctx, _result, snapshot, userAccountId) {
            const relations: RelationRow[] = [];

            for (const repo of snapshot.repos) {
                const repoId = await ctx.ensureRepo(repo);
                // Personal repos already grant admin via
                // mv_user_repo_permissions.
                if (repo.owner.login === snapshot.user.login) continue;
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

            // Forgejo does not expose org membership roles, so every
            // membership is recorded as "member"; the permission view expands
            // it regardless.
            for (const org of snapshot.orgs) {
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

            return { relations, complete: true };
        },
    });
}

/**
 * Order-insensitive signature of the permission snapshot: repo ids with their
 * owner and permission flags, and the org memberships.
 */
export function codebergSnapshotHash(
    repos: SyncRepo[],
    orgs: { providerId: number }[],
): string {
    return hashSnapshot({
        repos: repos
            .map((repo) => ({
                id: repo.providerId,
                // A repo transfer changes the effective owner grant (the view
                // grants admin via repo.account_id), so the owner must trip
                // the hash or transfers would never re-sync.
                owner: repo.owner.providerId,
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
): Promise<CodebergRepoRaw[]> {
    const results: CodebergRepoRaw[] = [];
    let page = 1;
    // Codeberg caps the effective page size at MAX_RESPONSE_ITEMS (50), so
    // requesting more would make `data.length < limit` break after page 1 and
    // silently drop repos beyond the first 50.
    const limit = 50;
    for (;;) {
        const data = await fetchCodebergJson<CodebergRepoRaw[]>(
            `/api/v1/users/${username}/repos?limit=${limit}&page=${page}`,
            accessToken,
        );
        if (!data || data.length === 0) break;
        for (const repo of data) results.push(repo);
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
    // Only a 404 means "this is not an org"; a 429/5xx must propagate or a
    // rate-limited lookup would misclassify orgs as users.
    if (res.status === 404) return false;
    if (!res.ok) {
        throw new Error(
            `Codeberg org lookup for "${username}" failed with status ${res.status}`,
        );
    }
    return true;
}

/**
 * Repositories the authenticated user owns or has access to, with the
 * effective permission level per repository.
 */
export async function getAuthenticatedUserRepos(
    accessToken: string,
): Promise<CodebergRepoRaw[]> {
    const results: CodebergRepoRaw[] = [];
    let page = 1;
    // See getReposByOwner: the server caps page size at 50.
    const limit = 50;
    for (;;) {
        const data = await fetchCodebergJson<CodebergRepoRaw[]>(
            `/api/v1/user/repos?limit=${limit}&page=${page}`,
            accessToken,
        );
        if (!data || data.length === 0) break;
        for (const repo of data) results.push(repo);
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
    // 404 means the resource does not exist: end of pagination, no orgs, etc.
    if (res.status === 404) return null;
    // Any other failure must abort the sync: a transient 429/5xx treated as
    // "no data" would turn the delete-then-insert rebuild below into a
    // destructive wipe of the user's grants.
    if (!res.ok) {
        throw new Error(
            `Codeberg API ${path} failed with status ${res.status}`,
        );
    }
    return res.json() as Promise<T>;
}
