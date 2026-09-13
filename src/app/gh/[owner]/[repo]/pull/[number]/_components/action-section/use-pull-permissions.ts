import {
    canPush,
    type PullRequestPermissionContext,
} from "~/app/[owner]/[repo]/_components/permissions-utils";
import type { PullsGetResponseData } from "~/server/github";

/**
 * Capability and merge-state flags for the action bar, derived once from
 * the permission context and the pull request data.
 */
export function usePullPermissions(
    permissionContext: PullRequestPermissionContext,
    pullRequest: PullsGetResponseData,
) {
    const isAuthor = permissionContext.isPullRequestAuthor;
    const canWrite = canPush(permissionContext);
    const canManagePR = isAuthor || canWrite;
    const canMerge = canWrite;
    const canInteract =
        !!permissionContext.currentUser &&
        (!permissionContext.isPullRequestLocked || canWrite || isAuthor);
    const isMergeBlocked = pullRequest.mergeable_state === "blocked";
    const isMergeStateUnknown = pullRequest.mergeable_state === "unknown";
    const isStackMerge = (pullRequest.stack?.position ?? 0) > 1;

    return {
        isAuthor,
        canWrite,
        canManagePR,
        canMerge,
        canInteract,
        isMergeBlocked,
        isMergeStateUnknown,
        isStackMerge,
    };
}
