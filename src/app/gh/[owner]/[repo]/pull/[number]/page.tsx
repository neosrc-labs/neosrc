import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, use } from "react";
import { getSession, githubAccessToken } from "~/server/auth";
import {
    getCachedPullRequest,
    getChecksForCommit,
    getConflictedFiles,
    getStackSuggestion,
    type PullsGetResponseData,
} from "~/server/github";
import { generatePRMetadata } from "~/server/metadata";
import { HeaderActionBar } from "./_components/action-section/header-action-bar";
import { PullRequestDescriptionSection } from "./_components/description";
import { PullRequestContent } from "./_components/pull-request-content";
import {
    TimelineSection,
    TimelineSkeleton,
} from "./_components/timeline/section";
import { PullRequestTitleSetter } from "./_components/title-setter";
import { getPullRequestPermissionContext } from "./permissions-server";
import type { PullRequestPermissionContext } from "./permissions-utils";

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
    return generatePRMetadata(owner, repo, number);
}

export default async function PullRequestPage({ params }: PageProps) {
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
                    Please sign in to view this pull request.
                </p>
            </div>
        );
    }

    const session = await getSession();
    const userId = session?.user?.id;
    const pullRequestPromise = getCachedPullRequest(
        accessToken,
        owner,
        repo,
        number,
        userId,
    );

    const conflictedFilesPromise = pullRequestPromise.then(async (pr) => {
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

    const checksPromise = pullRequestPromise.then((pr) =>
        getChecksForCommit(accessToken, owner, repo, pr.head.sha),
    );
    const permissionContextPromise = getPullRequestPermissionContext(
        accessToken,
        owner,
        repo,
        pullRequestPromise,
        userId,
    );
    const stackSuggestionPromise = getStackSuggestion(
        accessToken,
        owner,
        repo,
        number,
    );

    return (
        <div className="px-6 py-8">
            <PullRequestTitleSetter pullRequestPromise={pullRequestPromise} />
            <PullRequestDescriptionSection
                owner={owner}
                repo={repo}
                number={number}
                pullRequestPromise={pullRequestPromise}
                permissionContextPromise={permissionContextPromise}
                conflictedFilesPromise={conflictedFilesPromise}
                stackSuggestionPromise={stackSuggestionPromise}
                actionSection={
                    <HeaderActionBar
                        owner={owner}
                        repo={repo}
                        number={number}
                        pullRequestPromise={pullRequestPromise}
                        conflictedFilesPromise={conflictedFilesPromise}
                        permissionContextPromise={permissionContextPromise}
                        checkRunsPromise={checksPromise}
                    />
                }
            />

            <PullRequestContent
                owner={owner}
                repo={repo}
                number={number}
                pullRequestPromise={pullRequestPromise}
                timeline={
                    <Suspense
                        fallback={
                            <div className="mt-4 border-border border-t pt-6">
                                <h2 className="mb-4 text-text-primary">
                                    Timeline
                                </h2>
                                <TimelineSkeleton />
                            </div>
                        }
                    >
                        <TimelineSectionWithCanInteract
                            number={number}
                            owner={owner}
                            repo={repo}
                            permissionContextPromise={permissionContextPromise}
                            pullRequestPromise={pullRequestPromise}
                        />
                    </Suspense>
                }
            />
        </div>
    );
}
function TimelineSectionWithCanInteract({
    owner,
    repo,
    number,
    permissionContextPromise,
    pullRequestPromise,
}: {
    owner: string;
    repo: string;
    number: number;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
    pullRequestPromise: Promise<PullsGetResponseData>;
}) {
    const permissionContext = use(permissionContextPromise);
    const pullRequest = use(pullRequestPromise);
    return (
        <TimelineSection
            permissionContext={permissionContext}
            number={number}
            owner={owner}
            pullRequestState={pullRequest.state}
            repo={repo}
        />
    );
}
