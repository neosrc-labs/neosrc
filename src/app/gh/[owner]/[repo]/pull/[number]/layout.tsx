import type { ReactNode } from "react";
import { getSession, githubAccessToken } from "~/server/auth";
import {
    type CheckRun,
    getCachedPullRequest,
    getCheckRuns,
    getCommitStatuses,
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
import { PullRequestClientLayout } from "./layout-client";

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
    let userPermission: Promise<string | null> | null = Promise.resolve<
        string | null
    >(null);

    const accessToken = await githubAccessToken();
    const session = await getSession();

    if (accessToken && session?.user) {
        const userId = session.user.id;

        pullRequest = getCachedPullRequest(
            accessToken,
            owner,
            repo,
            number,
            userId,
        );

        userPermission = getUserRepoPermission(
            accessToken,
            owner,
            repo,
            session.user.githubUsername ?? "",
            userId,
        ).catch(() => null);

        // Fetch check runs and commit statuses if we have the PR head SHA
        checks = pullRequest.then((pullRequest) =>
            fetchChecks(accessToken, owner, repo, pullRequest.head.sha),
        );
    }

    return (
        <PullRequestClientLayout
            leftSidebar={
                <LeftSidebar
                    pullRequestPromise={pullRequest}
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
        </PullRequestClientLayout>
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
