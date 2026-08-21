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
