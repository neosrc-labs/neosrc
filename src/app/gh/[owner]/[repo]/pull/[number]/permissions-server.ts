import { getSession } from "~/server/auth";
import {
    getUserRepoPermission,
    type PullsGetResponseData,
} from "~/server/github";
import type { PullRequestPermissionContext } from "./permissions-utils";

export async function getPullRequestPermissionContext(
    accessToken: string,
    owner: string,
    repo: string,
    pullRequestPromise: Promise<PullsGetResponseData>,
    userId: string | undefined,
): Promise<PullRequestPermissionContext> {
    const session = await getSession();
    const currentUser = session?.user.githubUsername;
    if (!currentUser || !userId) {
        const pr = await pullRequestPromise;
        return {
            currentUser: null,
            repoPermission: null,
            isPullRequestLocked: pr.locked,
            isPullRequestAuthor: false,
        };
    }

    const [pr, userPermission] = await Promise.all([
        pullRequestPromise,
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
        isPullRequestLocked: pr.locked,
        isPullRequestAuthor: currentUser === pr.user?.login,
    };
}
