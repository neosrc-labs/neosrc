import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, use } from "react";
import { getSession, githubAccessToken } from "~/server/auth";
import {
    getCachedPullRequest,
    getChecksForCommit,
    getConflictedFiles,
    getStackSuggestion,
    getUserRepoPermission,
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

type PullsGetResponseData =
    RestEndpointMethodTypes["pulls"]["get"]["response"]["data"];

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
    const currentUserLogin = session?.user?.githubUsername ?? undefined;
    const pullRequestPromise = getCachedPullRequest(
        accessToken,
        owner,
        repo,
        number,
        userId,
    );

    const userPermissionPromise = currentUserLogin
        ? getUserRepoPermission(
              accessToken,
              owner,
              repo,
              currentUserLogin,
              userId ?? "",
          ).catch(() => null)
        : null;

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

    const canInteractPromise = computeCanInteract(
        accessToken,
        owner,
        repo,
        pullRequestPromise,
        userId,
    );
    const canEditPromise = computeCanEdit(
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
                canEditPromise={canEditPromise}
                canInteractPromise={canInteractPromise}
                pullRequestPromise={pullRequestPromise}
                owner={owner}
                repo={repo}
                number={number}
                conflictedFilesPromise={conflictedFilesPromise}
                stackSuggestionPromise={stackSuggestionPromise}
                actionSection={
                    <HeaderActionBar
                        owner={owner}
                        repo={repo}
                        number={number}
                        pullRequestPromise={pullRequestPromise}
                        conflictedFilesPromise={conflictedFilesPromise}
                        userPermissionPromise={userPermissionPromise}
                        currentUserLogin={currentUserLogin}
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
                            canInteractPromise={canInteractPromise}
                            number={number}
                            owner={owner}
                            repo={repo}
                        />
                    </Suspense>
                }
            />
        </div>
    );
}

async function computeCanInteract(
    accessToken: string,
    owner: string,
    repo: string,
    pullRequestPromise: Promise<PullsGetResponseData>,
    userId: string | undefined,
) {
    const session = await getSession();
    const currentUser = session?.user.githubUsername;
    if (!currentUser || !userId) {
        return false;
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

    return (
        !pr.locked ||
        userPermission === "admin" ||
        userPermission === "write" ||
        userPermission === "read" ||
        currentUser === pr.user?.login
    );
}

/**
 * Strict capability check for edit-class operations on the PR body (e.g.
 * clicking a task-list checkbox). Unlike {@link computeCanInteract}, this is
 * not granted for read-only viewers on unlocked PRs -- only repo maintainers
 * (write/admin) or the PR author may edit. Anonymous users never have edit
 * capability. The locked state is not modeled here because GitHub itself
 * permits body edits on locked PRs by maintainers, and the permission/author
 * checks already cover who can edit.
 */
async function computeCanEdit(
    accessToken: string,
    owner: string,
    repo: string,
    pullRequestPromise: Promise<PullsGetResponseData>,
    userId: string | undefined,
) {
    const session = await getSession();
    const currentUser = session?.user.githubUsername;
    if (!currentUser || !userId) return false;
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
    return (
        userPermission === "admin" ||
        userPermission === "write" ||
        currentUser === pr.user?.login
    );
}

function TimelineSectionWithCanInteract({
    canInteractPromise,
    owner,
    repo,
    number,
}: {
    canInteractPromise: Promise<boolean>;
    owner: string;
    repo: string;
    number: number;
}) {
    const canInteract = use(canInteractPromise);
    return (
        <TimelineSection
            canInteract={canInteract}
            number={number}
            owner={owner}
            repo={repo}
        />
    );
}
