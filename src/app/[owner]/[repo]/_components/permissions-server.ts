import { getSession } from "~/server/auth";
import { getUserRepoPermission } from "~/server/github";
import {
    getRepoPermissionForUser,
    type RepoPermissionLevel,
} from "~/server/repo-cache";
import type { Provider } from "~/utils/provider-url";
import type { PullRequestPermissionContext } from "./permissions-utils";

/**
 * Viewer permission context for an issue or pull request page. GitHub resolves
 * the viewer's repo permission through the API; Codeberg uses the synced
 * materialized view, since its session carries no API grant.
 */
export async function getIssuePermissionContext({
    provider,
    accessToken,
    owner,
    repo,
    subjectPromise,
    userId,
}: {
    provider: Provider;
    accessToken: string;
    owner: string;
    repo: string;
    subjectPromise: Promise<{
        locked: boolean;
        user?: { login: string } | null;
    }>;
    userId: string | undefined;
}): Promise<PullRequestPermissionContext> {
    const session = await getSession();

    if (provider === "cb") {
        const currentUser = session?.user?.codebergUsername ?? null;
        const [subject, permission] = await Promise.all([
            subjectPromise,
            getRepoPermissionForUser("codeberg", currentUser, owner, repo),
        ]);
        return {
            currentUser,
            repoPermission: mapCodebergPermission(permission),
            // Codeberg has no issue lock.
            isPullRequestLocked: false,
            isPullRequestAuthor: currentUser === subject.user?.login,
        };
    }

    const currentUser = session?.user.githubUsername;
    if (!currentUser || !userId) {
        const subject = await subjectPromise;
        return {
            currentUser: null,
            repoPermission: null,
            isPullRequestLocked: subject.locked,
            isPullRequestAuthor: false,
        };
    }

    const [subject, userPermission] = await Promise.all([
        subjectPromise,
        getUserRepoPermission(
            accessToken,
            owner,
            repo,
            currentUser,
            userId,
        ).catch(() => null),
    ]);

    return {
        currentUser,
        repoPermission: userPermission,
        isPullRequestLocked: subject.locked,
        isPullRequestAuthor: currentUser === subject.user?.login,
    };
}

function mapCodebergPermission(
    permission: RepoPermissionLevel | null,
): PullRequestPermissionContext["repoPermission"] {
    switch (permission) {
        case "admin":
            return "admin";
        case "write":
        case "maintain":
            return "write";
        case "triage":
        case "read":
            return "read";
        default:
            return null;
    }
}
