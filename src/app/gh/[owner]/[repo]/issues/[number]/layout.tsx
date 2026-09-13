import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getIssuePermissionContext } from "~/app/[owner]/[repo]/_components/permissions-server";
import {
    disabled,
    type PullRequestPermissionContext,
} from "~/app/[owner]/[repo]/_components/permissions-utils";
import { getSession, githubAccessToken } from "~/server/auth";
import type { IssueGetResponseData } from "~/server/github";
import { IssueLeftSidebar } from "./_components/issue-left-sidebar";
import { IssueRightSidebar } from "./_components/issue-right-sidebar";
import { IssueClientLayout } from "./layout-client";
import { loadIssueForRoute } from "./load-issue";

interface LayoutProps {
    children: ReactNode;
    params: Promise<{
        owner: string;
        repo: string;
        number: string;
    }>;
}

export default async function IssueLayout({ children, params }: LayoutProps) {
    const { owner, repo, number: numberStr } = await params;
    const number = Number(numberStr);

    if (
        !/^[0-9]+$/.test(numberStr) ||
        !Number.isInteger(number) ||
        number < 1
    ) {
        notFound();
    }

    let issue: Promise<IssueGetResponseData> | null = null;
    let permissionContextPromise: Promise<PullRequestPermissionContext> =
        Promise.resolve(disabled());

    const accessToken = await githubAccessToken();
    const session = await getSession();

    if (accessToken) {
        const userId = session?.user?.id ?? null;

        issue = loadIssueForRoute(accessToken, owner, repo, number);

        permissionContextPromise = getIssuePermissionContext({
            provider: "gh",
            accessToken,
            owner,
            repo,
            subjectPromise: issue,
            userId: userId ?? undefined,
        });
    }

    return (
        <IssueClientLayout
            leftSidebar={
                <IssueLeftSidebar
                    number={number}
                    owner={owner}
                    repo={repo}
                    commentCountPromise={issue?.then((i) => i.comments) ?? null}
                />
            }
            rightSidebar={
                <IssueRightSidebar
                    permissionContextPromise={permissionContextPromise}
                    issuePromise={issue}
                    owner={owner}
                    repo={repo}
                    number={number}
                />
            }
        >
            {children}
        </IssueClientLayout>
    );
}
