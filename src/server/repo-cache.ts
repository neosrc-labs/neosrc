import { aliasedTable, and, eq, sql } from "drizzle-orm";
import { after } from "next/server";

import { db } from "./db";
import { account, mvUserRepoPermissions, repo } from "./db/schema";
import type { RepoVisibility, SyncProvider } from "./sync/shared";
import { upsertAccount, upsertRepo } from "./sync/shared";

/**
 * Repo metadata cache backed by the repo table itself (raw_data + last_synced)
 * instead of the generic cache table. Sync writes and page-load fetches both
 * land in the same row, so a repo that was permission-synced (REST path) is
 * already a warm cache entry.
 *
 * Semantics match the generic withStaleWhileRevalidate: fresh rows are served
 * from raw_data, stale rows are served with a background revalidation, and
 * misses (no row, or a GraphQL-synced row whose raw_data is null) fetch and
 * upsert before returning.
 */

export type CachedRepoSource<T> = {
    provider: SyncProvider;
    /** Owner login/username, as it appears in the URL slug. */
    owner: string;
    repo: string;
    /** Serve cached raw_data while younger than this. */
    staleAfterMs: number;
    /** Fetch the full provider payload; null when the repo does not exist. */
    fetcher: () => Promise<T | null>;
    /** Map the payload to the canonical repo columns (see sync/mappers.ts). */
    toRepo: (payload: T) => {
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
    };
};

export async function getCachedRepoData<T>(
    source: CachedRepoSource<T>,
): Promise<T> {
    const { provider, owner, repo: repoName, staleAfterMs } = source;

    let row: { repo: typeof repo.$inferSelect } | undefined;
    try {
        const [found] = await db
            .select()
            .from(repo)
            .innerJoin(account, eq(repo.accountId, account.id))
            .where(
                and(
                    eq(repo.provider, provider),
                    eq(account.provider, provider),
                    // Provider APIs are case-insensitive on owner/repo slugs, so
                    // the lookup must be too: the cache row stores canonical
                    // casing from the API, while the URL slug may differ.
                    eq(sql`lower(${account.username})`, owner.toLowerCase()),
                    eq(sql`lower(${repo.name})`, repoName.toLowerCase()),
                ),
            )
            .limit(1);
        row = found;
    } catch {
        // DB read failure: treat as a miss and fetch fresh rather than 500.
    }

    const cached = row?.repo;
    if (cached?.rawData != null) {
        const lastSynced = cached.lastSynced?.getTime() ?? 0;
        const fresh = Date.now() - lastSynced < staleAfterMs;
        if (fresh) return cached.rawData as T;

        // Stale: serve now, revalidate after the response is flushed.
        try {
            after(() => {
                void refresh().catch(() => {
                    // Revalidation failure keeps serving the stale payload.
                });
            });
        } catch {
            // Not in a request scope -- skip the background revalidation.
        }
        return cached.rawData as T;
    }

    return refresh();

    async function refresh(): Promise<T> {
        const payload = await source.fetcher();
        if (!payload) throw new Error("Repo not found");
        try {
            const mapped = source.toRepo(payload);
            const ownerAccountId = await upsertAccount(db, {
                provider,
                providerId: mapped.owner.providerId,
                username: mapped.owner.login,
                type: mapped.owner.type,
                avatarUrl: mapped.owner.avatarUrl,
            });
            await upsertRepo(db, {
                provider,
                providerId: mapped.providerId,
                name: mapped.name,
                visibility: mapped.visibility,
                description: mapped.description,
                stars: mapped.stars,
                watchers: mapped.watchers,
                forks: mapped.forks,
                defaultBranch: mapped.defaultBranch,
                archived: mapped.archived,
                accountId: ownerAccountId,
                rawData: payload,
            });
        } catch {
            // A cache write failure must not fail the fetch that succeeded;
            // the payload is served and the next request retries the write.
        }
        return payload;
    }
}

/** Effective permission level a viewer holds on a repo. */
export type RepoPermissionLevel =
    | "read"
    | "triage"
    | "write"
    | "maintain"
    | "admin";

/**
 * The viewer's effective permission on a repo per mv_user_repo_permissions,
 * or null when the viewer is not linked to the provider or has no grant.
 *
 * The repo-table cache is shared across users, so the cached payload's
 * `permissions` field is whoever-last-wrote it -- never trust it for the
 * current viewer; resolve access from the materialized view instead.
 */
export async function getRepoPermissionForUser(
    provider: SyncProvider,
    providerUsername: string | null,
    owner: string,
    repoName: string,
): Promise<RepoPermissionLevel | null> {
    if (!providerUsername) return null;

    const ownerAccount = aliasedTable(account, "owner_account");
    const viewerAccount = aliasedTable(account, "viewer_account");

    const [row] = await db
        .select({ permission: mvUserRepoPermissions.effectivePermission })
        .from(repo)
        .innerJoin(ownerAccount, eq(repo.accountId, ownerAccount.id))
        .innerJoin(
            viewerAccount,
            and(
                eq(viewerAccount.provider, provider),
                eq(viewerAccount.username, providerUsername),
            ),
        )
        .innerJoin(
            mvUserRepoPermissions,
            and(
                eq(mvUserRepoPermissions.repoId, repo.id),
                eq(mvUserRepoPermissions.userId, viewerAccount.id),
            ),
        )
        .where(
            and(
                eq(repo.provider, provider),
                // Same case-insensitive slug matching as the cache lookup: the
                // stored rows carry canonical API casing.
                eq(sql`lower(${ownerAccount.username})`, owner.toLowerCase()),
                eq(sql`lower(${repo.name})`, repoName.toLowerCase()),
            ),
        )
        .limit(1);

    return (row?.permission ?? null) as RepoPermissionLevel | null;
}

export type ViewerRepoAccess = {
    /** False when the repo is private and the viewer holds no grant. */
    canView: boolean;
    admin: boolean;
};

/**
 * Composes the viewer's access from the view lookup and the payload's
 * owner/private flags. The owner login is global truth (not viewer-dependent),
 * so the owner is always admin and always may view -- this also covers a
 * just-cached repo whose row is not yet in the refreshed view.
 */
export function viewerRepoAccess(params: {
    username: string | null;
    payload: { owner: { login: string }; private: boolean };
    permission: RepoPermissionLevel | null;
}): ViewerRepoAccess {
    const { username, payload, permission } = params;
    const isOwner = username !== null && payload.owner.login === username;
    return {
        canView: !payload.private || isOwner || permission !== null,
        admin: isOwner || permission === "admin",
    };
}
