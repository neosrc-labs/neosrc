import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { IssueDetail } from "~/server/api/routers/issues/types";
import {
    codebergAccessToken,
    getSession,
    githubAccessToken,
} from "~/server/auth";
import type { Provider } from "~/utils/provider-url";
import { getIssuePermissionContext } from "../../_components/permissions-server";
import {
    disabled,
    type PullRequestPermissionContext,
} from "../../_components/permissions-utils";
import { IssueClientLayout } from "./_components/issue-client-layout";
import { IssueLeftSidebar } from "./_components/issue-left-sidebar";
import { IssueRightSidebar } from "./_components/issue-right-sidebar";
import { loadIssueForRoute } from "./load-issue";

interface IssueLayoutProps {
    provider: Provider;
    children: ReactNode;
    params: Promise<{
        owner: string;
        repo: string;
        number: string;
    }>;
}

export async function IssueLayout({
    provider,
    children,
    params,
}: IssueLayoutProps) {
    const { owner, repo, number: numberStr } = await params;
    const number = Number(numberStr);

    if (
        !/^[0-9]+$/.test(numberStr) ||
        !Number.isInteger(number) ||
        number < 1
    ) {
        notFound();
    }

    let issue: Promise<IssueDetail> | null = null;
    let permissionContextPromise: Promise<PullRequestPermissionContext> =
        Promise.resolve(disabled());

    const accessToken =
        provider === "cb"
            ? await codebergAccessToken()
            : await githubAccessToken();
    const session = await getSession();

    if (accessToken) {
        const userId = session?.user?.id ?? null;

        issue = loadIssueForRoute(provider, accessToken, owner, repo, number);

        permissionContextPromise = getIssuePermissionContext({
            provider,
            accessToken,
            owner,
            repo,
            subjectPromise: issue.then((i) => ({
                locked: i.locked,
                user: i.author ? { login: i.author.login } : null,
            })),
            userId: userId ?? undefined,
        });
    }

    return (
        <IssueClientLayout
            leftSidebar={
                <IssueLeftSidebar
                    provider={provider}
                    number={number}
                    owner={owner}
                    repo={repo}
                    commentCountPromise={issue?.then((i) => i.comments) ?? null}
                />
            }
            rightSidebar={
                <IssueRightSidebar
                    provider={provider}
                    editable={provider === "gh"}
                    metadataPromise={issue}
                    permissionContextPromise={permissionContextPromise}
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
