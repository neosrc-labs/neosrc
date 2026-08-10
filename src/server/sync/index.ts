import {
    fetchOwnerRepos as fetchCodebergOwnerRepos,
    syncCurrentUserCodeberg,
} from "./codeberg";
import {
    fetchOwnerRepos as fetchGithubOwnerRepos,
    syncCurrentUserGitHub,
} from "./github";
import type { Db, SyncProvider, SyncResult } from "./shared";
import { createSyncContext, newResult, refreshPermissionsView } from "./shared";

export type {
    RelationName,
    RepoPermission,
    SyncProvider,
    SyncRepo,
    SyncResult,
} from "./shared";
export { refreshPermissionsView } from "./shared";

/**
 * Upserts the account row for `owner` plus every repository it owns.
 * Refreshes the permission view afterwards.
 */
export async function refreshOwnerRepos(
    db: Db,
    input: { provider: SyncProvider; owner: string; accessToken: string },
): Promise<SyncResult> {
    const fetcher =
        input.provider === "github"
            ? fetchGithubOwnerRepos
            : fetchCodebergOwnerRepos;
    const { owner, repos } = await fetcher(input.accessToken, input.owner);

    const result = newResult();
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
 * effective permissions.
 *
 * Incremental by default: the permission snapshot is hashed and compared to
 * the last applied hash, skipping all writes and the materialized-view
 * refresh when nothing changed. Pass `force: true` to always re-sync (e.g.
 * for the manual button in the UI).
 */
export async function syncCurrentUser(
    db: Db,
    input: {
        provider: SyncProvider;
        accessToken: string;
        userId: string;
        force?: boolean;
    },
): Promise<SyncResult> {
    const force = input.force ?? false;
    if (input.provider === "github") {
        return syncCurrentUserGitHub(db, {
            accessToken: input.accessToken,
            userId: input.userId,
            force,
        });
    }
    return syncCurrentUserCodeberg(db, {
        accessToken: input.accessToken,
        userId: input.userId,
        force,
    });
}
