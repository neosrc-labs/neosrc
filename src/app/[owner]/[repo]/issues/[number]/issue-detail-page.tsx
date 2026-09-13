import { notFound } from "next/navigation";
import { Suspense, use } from "react";
import { DocumentTitleSetter } from "~/components/document-title-setter";
import type { IssueDetail } from "~/server/api/routers/issues/types";
import {
    codebergAccessToken,
    getSession,
    githubAccessToken,
} from "~/server/auth";
import type { Provider } from "~/utils/provider-url";
import { getIssuePermissionContext } from "../../_components/permissions-server";
import type { PullRequestPermissionContext } from "../../_components/permissions-utils";
import { IssueDescriptionSection } from "./_components/issue-description-section";
import {
    IssueTimelineSection,
    TimelineSkeleton,
} from "./_components/issue-timeline-section";
import { loadIssueForRoute } from "./load-issue";

interface IssueDetailPageProps {
    provider: Provider;
    params: Promise<{
        owner: string;
        repo: string;
        number: string;
    }>;
}

export async function IssueDetailPage({
    provider,
    params,
}: IssueDetailPageProps) {
    const { owner, repo, number: numberAsStr } = await params;
    const accessToken =
        provider === "cb"
            ? await codebergAccessToken()
            : await githubAccessToken();
    const number = Number(numberAsStr);

    if (
        !/^[0-9]+$/.test(numberAsStr) ||
        !Number.isInteger(number) ||
        number < 1
    ) {
        notFound();
    }

    if (!accessToken) {
        return (
            <div className="px-6 py-8">
                <p className="text-text-secondary">
                    Please sign in to view this issue.
                </p>
            </div>
        );
    }

    const session = await getSession();
    const userId = session?.user?.id;
    const issuePromise = loadIssueForRoute(
        provider,
        accessToken,
        owner,
        repo,
        number,
    );
    const permissionContextPromise = getIssuePermissionContext({
        provider,
        accessToken,
        owner,
        repo,
        subjectPromise: issuePromise.then((issue) => ({
            locked: issue.locked,
            user: issue.author ? { login: issue.author.login } : null,
        })),
        userId,
    });

    return (
        <div className="px-6 py-8">
            <DocumentTitleSetter
                titlePromise={issuePromise.then(
                    (issue) => `${issue.title} - ${owner}/${repo} #${number}`,
                )}
            />
            <IssueDescriptionSection
                provider={provider}
                owner={owner}
                repo={repo}
                number={number}
                issuePromise={issuePromise}
                permissionContextPromise={permissionContextPromise}
            />

            <Suspense
                fallback={
                    <div className="mt-4 border-border border-t pt-6">
                        <h2 className="mb-4 text-text-primary">Timeline</h2>
                        <TimelineSkeleton />
                    </div>
                }
            >
                <IssueTimelineSectionWithContext
                    provider={provider}
                    number={number}
                    owner={owner}
                    repo={repo}
                    permissionContextPromise={permissionContextPromise}
                    issuePromise={issuePromise}
                />
            </Suspense>
        </div>
    );
}

function IssueTimelineSectionWithContext({
    provider,
    owner,
    repo,
    number,
    permissionContextPromise,
    issuePromise,
}: {
    provider: Provider;
    owner: string;
    repo: string;
    number: number;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
    issuePromise: Promise<IssueDetail>;
}) {
    const permissionContext = use(permissionContextPromise);
    const issue = use(issuePromise);

    return (
        <IssueTimelineSection
            provider={provider}
            permissionContext={permissionContext}
            number={number}
            owner={owner}
            issueState={issue.state}
            repo={repo}
        />
    );
}
