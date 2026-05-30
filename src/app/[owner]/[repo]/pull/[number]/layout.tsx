import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { ResizableLayout } from "~/components/ResizableLayout";
import { getSession } from "~/server/auth";
import { db } from "~/server/db";
import { betterAuthAccount } from "~/server/db/schema";
import {
    type CheckRun,
    getAuthenticatedUser,
    getCheckRuns,
    getConflictedFiles,
    getPullRequest,
    getPullRequestCommits,
    getUserRepoPermission,
    type PullsGetResponseData,
    type PullsListCommitsResponseData,
} from "~/server/github";
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
    const session = await getSession(await headers());

    let pullRequest: Promise<PullsGetResponseData> | null = null;
    let commits: Promise<PullsListCommitsResponseData> | null = null;
    let checks: Promise<Array<CheckRun>> | null = new Promise(() => {});
    let conflictedFiles: Promise<string[]> | null = new Promise(() => {});
    let userPermission: Promise<string | null> | null = new Promise(() => {});
    let currentUserLogin: string | undefined;

    if (session?.user?.id) {
        const [account] = await db
            .select({ accessToken: betterAuthAccount.accessToken })
            .from(betterAuthAccount)
            .where(eq(betterAuthAccount.userId, session.user.id))
            .limit(1);

        if (account?.accessToken) {
            const accessToken = account.accessToken;
            commits = getPullRequestCommits(accessToken, owner, repo, number);
            pullRequest = getPullRequest(accessToken, owner, repo, number);
            currentUserLogin = (await getAuthenticatedUser(accessToken)).login;

            userPermission = getUserRepoPermission(
                accessToken,
                owner,
                repo,
                currentUserLogin,
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

            // Fetch check runs if we have the PR head SHA
            checks = pullRequest.then(async (pullRequest) => {
                if (pullRequest?.head?.sha) {
                    const checksResult = await getCheckRuns(
                        accessToken,
                        owner,
                        repo,
                        pullRequest.head.sha,
                    );

                    return (checksResult.check_runs || []).map(
                        (check: {
                            name: string;
                            conclusion: string | null;
                            status: string;
                            html_url?: string;
                            details_url?: string | null;
                            started_at?: string | null;
                            completed_at?: string | null;
                            app?: {
                                name: string;
                                icon?: string | null;
                            } | null;
                        }) => ({
                            name: check.name,
                            conclusion: check.conclusion,
                            status: check.status,
                            html_url: check.html_url,
                            details_url: check.details_url,
                            started_at: check.started_at,
                            completed_at: check.completed_at,
                            app: check.app
                                ? { name: check.app.name, icon: check.app.icon }
                                : null,
                        }),
                    );
                }
                return [];
            });
        }
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
                    checksPromise={checks}
                    commitsPromise={commits}
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
