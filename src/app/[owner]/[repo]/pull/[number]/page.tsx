import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import type { Metadata } from "next";
import { Suspense, use } from "react";
import { getSession, githubAccessToken } from "~/server/auth";
import { getCachedPullRequest, getUserRepoPermission } from "~/server/github";
import { generatePRMetadata } from "~/server/metadata";
import { PullRequestDescriptionSection } from "./_components/description";
import {
    TimelineSection,
    TimelineSkeleton,
} from "./_components/timeline-section";

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
    const number = parseInt(numberAsStr, 10);

    if (!accessToken) {
        return (
            <div className="px-6 py-8">
                <p className="text-gray-600 dark:text-gray-400">
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
    const canInteractPromise = computeCanInteract(
        accessToken,
        owner,
        repo,
        pullRequestPromise,
        userId,
    );

    return (
        <div className="px-6 py-8">
            <PullRequestDescriptionSection
                canInteractPromise={canInteractPromise}
                pullRequestPromise={pullRequestPromise}
                owner={owner}
                repo={repo}
                number={number}
            />

            <Suspense
                fallback={
                    <div className="mt-4 border-gray-200 border-t pt-6 dark:border-zinc-700">
                        <h2 className="mb-4 font-semibold text-gray-900 text-lg dark:text-gray-100">
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
        const pr = await pullRequestPromise;
        return !pr.locked;
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
