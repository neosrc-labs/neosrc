import type { ReactNode } from "react";
import { ResizableLayout } from "~/components/ResizableLayout";
import { getAccount, getSession } from "~/server/auth";
import {
    type CheckRun,
    getCachedPullRequest,
    getCheckRuns,
    getCommitStatuses,
    getConflictedFiles,
    getUserRepoPermission,
    type PullsGetResponseData,
} from "~/server/github";
import {
    deduplicateCommitStatuses,
    mapGitHubCheckRunToCheckRun,
    mapStatusToCheckRun,
} from "~/utils/status-checks";
import LeftSidebar from "./_components/left-sidebar";
import RightSidebar from "./_components/right-sidebar";

interface LayoutProps {
    children: ReactNode;
    params: Promise<{
        owner: string;
        repo: string;
        number: string;
    }>;
}

export default async function PullRequestLayout({
    children,
    params,
}: LayoutProps) {
    const { owner, repo, number: numberStr } = await params;
    const number = parseInt(numberStr, 10);
    let pullRequest: Promise<PullsGetResponseData> | null = null;
    let checks: Promise<Array<CheckRun>> | null = Promise.resolve<CheckRun[]>(
        [],
    );
    let conflictedFiles: Promise<string[]> | null = Promise.resolve<string[]>(
        [],
    );
    let userPermission: Promise<string | null> | null = Promise.resolve<
        string | null
    >(null);
    let currentUserLogin: string | undefined;

    const account = await getAccount();

    if (account?.accessToken) {
        const accessToken = account.accessToken;
        const userId = account.userId;
        pullRequest = getCachedPullRequest(
            accessToken,
            owner,
            repo,
            number,
            userId,
        );
        const session = await getSession();

        currentUserLogin = session?.user.githubUsername ?? undefined;
        if (!currentUserLogin) {
            throw new Error("github username name not found");
        }

        userPermission = getUserRepoPermission(
            accessToken,
            owner,
            repo,
            currentUserLogin,
            userId,
        ).catch(() => null);

        // Fetch conflicted files if there are merge conflicts
        conflictedFiles = pullRequest.then(async (pr) => {
            if (pr.mergeable_state === "dirty") {
                return getConflictedFiles(
                    accessToken,
                    owner,
                    repo,
                    pr.base.sha,
                    pr.head.sha,
                );
            }
            return [];
        });

        // Fetch check runs and commit statuses if we have the PR head SHA
        checks = pullRequest.then((pullRequest) =>
            fetchChecks(accessToken, owner, repo, pullRequest.head.sha),
        );
    }

    return (
        <ResizableLayout
            leftSidebar={
                <LeftSidebar
                    currentUserLogin={currentUserLogin}
                    userPermissionPromise={userPermission}
                    pullRequestPromise={pullRequest}
                    conflictedFilesPromise={conflictedFiles}
                    number={number}
                    owner={owner}
                    repo={repo}
                />
            }
            rightSidebar={
                <RightSidebar
                    userPermission={userPermission}
                    checksPromise={checks}
                    pullRequestPromise={pullRequest}
                    owner={owner}
                    repo={repo}
                    number={number}
                />
            }
        >
            {children}
        </ResizableLayout>
    );
}

async function fetchChecks(
    accessToken: string,
    owner: string,
    repo: string,
    headSha: string,
): Promise<CheckRun[]> {
    const [checksResult, statuses] = await Promise.all([
        getCheckRuns(accessToken, owner, repo, headSha),
        getCommitStatuses(accessToken, owner, repo, headSha),
    ]);

    const checkRunItems = (checksResult.check_runs ?? []).map(
        mapGitHubCheckRunToCheckRun,
    );

    const statusItems = deduplicateCommitStatuses(statuses ?? []).map(
        mapStatusToCheckRun,
    );

    return [...checkRunItems, ...statusItems];
}
