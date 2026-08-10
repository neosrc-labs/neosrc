import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getSession, githubAccessToken } from "~/server/auth";
import {
    type CheckRun,
    getCachedPullRequest,
    getChecksForCommit,
    getUserRepoPermission,
    type PullsGetResponseData,
} from "~/server/github";
import { EMPTY_ARRAY_PROMISE, NULL_PROMISE } from "~/utils/promise";
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
    const number = Number(numberStr);

    if (
        !/^[0-9]+$/.test(numberStr) ||
        !Number.isInteger(number) ||
        number < 1
    ) {
        notFound();
    }

    let pullRequest: Promise<PullsGetResponseData> | null = null;
    let checks: Promise<Array<CheckRun>> | null = EMPTY_ARRAY_PROMISE;
    let userPermission: Promise<string | null> | null = NULL_PROMISE;
    let currentUserLogin: string | undefined;

    const accessToken = await githubAccessToken();
    const session = await getSession();

    if (accessToken) {
        const userId = session?.user?.id ?? null;
        currentUserLogin = session?.user?.githubUsername ?? undefined;

        pullRequest = getCachedPullRequest(
            accessToken,
            owner,
            repo,
            number,
            userId,
        );

        if (currentUserLogin) {
            userPermission = getUserRepoPermission(
                accessToken,
                owner,
                repo,
                currentUserLogin,
                userId ?? "",
            ).catch(() => null);
        }

        // Fetch check runs and commit statuses if we have the PR head SHA
        checks = pullRequest.then((pullRequest) =>
            fetchChecks(accessToken, owner, repo, pullRequest.head.sha),
        );
    }

    return (
        <PullRequestClientLayout
            leftSidebar={
                <LeftSidebar
                    number={number}
                    owner={owner}
                    repo={repo}
                    pullRequestPromise={pullRequest}
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
    return getChecksForCommit(accessToken, owner, repo, headSha);
}
