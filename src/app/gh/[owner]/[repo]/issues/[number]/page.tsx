import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, use } from "react";
import { DocumentTitleSetter } from "~/components/document-title-setter";
import { getSession, githubAccessToken } from "~/server/auth";
import type { IssueGetResponseData } from "~/server/github";
import { generateIssueMetadata } from "~/server/metadata";
import { getPullRequestPermissionContext } from "../../pull/[number]/permissions-server";
import type { PullRequestPermissionContext } from "../../pull/[number]/permissions-utils";
import { IssueDescriptionSection } from "./_components/issue-description-section";
import {
    IssueTimelineSection,
    TimelineSkeleton,
} from "./_components/issue-timeline-section";
import { loadIssueForRoute } from "./load-issue";

interface PageProps {
    params: Promise<{
        owner: string;
        repo: string;
        number: string;
    }>;
}

export async function generateMetadata({
    params,
}: PageProps): Promise<Metadata> {
    const { owner, repo, number } = await params;
    return generateIssueMetadata(owner, repo, number);
}

export default async function IssuePage({ params }: PageProps) {
    const { owner, repo, number: numberAsStr } = await params;
    const accessToken = await githubAccessToken();
    const number = Number(numberAsStr);

    if (
        !/^[0-9]+$/.test(numberAsStr) ||
        !Number.isInteger(number) ||
        number < 1
    ) {
        notFound();
        return;
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
    const issuePromise = loadIssueForRoute(accessToken, owner, repo, number);
    const permissionContextPromise = getPullRequestPermissionContext(
        accessToken,
        owner,
        repo,
        issuePromise,
        userId,
    );

    return (
        <div className="px-6 py-8">
            <DocumentTitleSetter
                titlePromise={issuePromise.then(
                    (issue) => `${issue.title} - ${owner}/${repo} #${number}`,
                )}
            />
            <IssueDescriptionSection
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
    owner,
    repo,
    number,
    permissionContextPromise,
    issuePromise,
}: {
    owner: string;
    repo: string;
    number: number;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
    issuePromise: Promise<IssueGetResponseData>;
}) {
    const permissionContext = use(permissionContextPromise);
    const issue = use(issuePromise);

    return (
        <IssueTimelineSection
            permissionContext={permissionContext}
            number={number}
            owner={owner}
            issueState={issue.state === "open" ? "open" : "closed"}
            repo={repo}
        />
    );
}
