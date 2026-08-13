export type PullRequestPermissionContext = {
    isPullRequestLocked: boolean;
    isPullRequestAuthor: boolean;
    repoPermission: "admin" | "none" | "read" | "write" | null;
    currentUser: string | null;
};

export function canInteract({
    isPullRequestAuthor,
    isPullRequestLocked,
    repoPermission,
}: PullRequestPermissionContext): boolean {
    return (
        !isPullRequestLocked ||
        repoPermission === "admin" ||
        repoPermission === "write" ||
        repoPermission === "read" ||
        isPullRequestAuthor
    );
}

export function canEdit({
    isPullRequestAuthor,
    repoPermission,
}: PullRequestPermissionContext): boolean {
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
