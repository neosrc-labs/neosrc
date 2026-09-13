export type PullRequestPermissionContext = {
    isPullRequestLocked: boolean;
    isPullRequestAuthor: boolean;
    repoPermission: "admin" | "none" | "read" | "write" | null;
    currentUser: string | null;
};

export function canInteract({
    currentUser,
    isPullRequestAuthor,
    isPullRequestLocked,
    repoPermission,
}: PullRequestPermissionContext): boolean {
    if (!currentUser) {
        return false;
    }
    return (
        !isPullRequestLocked ||
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
