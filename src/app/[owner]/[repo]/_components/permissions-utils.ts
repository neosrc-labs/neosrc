import type { Provider } from "~/utils/provider-url";

export type PullRequestPermissionContext = {
    isPullRequestLocked: boolean;
    isPullRequestAuthor: boolean;
    repoPermission: "admin" | "none" | "read" | "write" | null;
    currentUser: string | null;
    /** Defaults to GitHub for contexts built before the provider was known. */
    provider?: Provider;
};

export function canInteract({
    currentUser,
    isPullRequestAuthor,
    isPullRequestLocked,
    repoPermission,
    provider = "gh",
}: PullRequestPermissionContext): boolean {
    if (!currentUser) {
        return false;
    }
    if (!isPullRequestLocked) {
        return true;
    }
    // Forgejo restricts a locked issue to write access, so a read-level
    // collaborator gets no comment or reaction controls there.
    if (provider === "cb") {
        return (
            repoPermission === "admin" ||
            repoPermission === "write" ||
            isPullRequestAuthor
        );
    }
    return (
        repoPermission === "admin" ||
        repoPermission === "write" ||
        repoPermission === "read" ||
        isPullRequestAuthor
    );
}

export function canEdit({
    currentUser,
    isPullRequestAuthor,
    repoPermission,
}: PullRequestPermissionContext): boolean {
    if (!currentUser) {
        return false;
    }
    return (
        repoPermission === "admin" ||
        repoPermission === "write" ||
        isPullRequestAuthor
    );
}

/**
 * Push access on the repository. Required for anything that writes commits or
 * branches, such as GitHub's web conflict editor.
 */
export function canPush({
    currentUser,
    repoPermission,
}: PullRequestPermissionContext): boolean {
    if (!currentUser) {
        return false;
    }
    return repoPermission === "admin" || repoPermission === "write";
}

export function canResolveReviewThread({
    currentUser,
    isPullRequestAuthor,
    repoPermission,
}: PullRequestPermissionContext): boolean {
    if (!currentUser) {
        return false;
    }
    return (
        repoPermission === "admin" ||
        repoPermission === "write" ||
        isPullRequestAuthor
    );
}

export function disabled(): PullRequestPermissionContext {
    return {
        currentUser: null,
        isPullRequestAuthor: false,
        repoPermission: null,
        isPullRequestLocked: true,
    };
}
