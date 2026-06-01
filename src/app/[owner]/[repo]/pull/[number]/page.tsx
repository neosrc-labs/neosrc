import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import type { Metadata } from "next";
import { Suspense } from "react";
import { githubAccessToken } from "~/server/auth";
import {
    getAuthenticatedUser,
    getPullRequest,
    getUserRepoPermission,
} from "~/server/github";
import { generatePRMetadata } from "~/server/metadata";
import { PullRequestDescriptionSection } from "./_components/description";
import { TimelineSection } from "./_components/timeline-section";

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

    const pullRequest: Promise<PullsGetResponseData> = getPullRequest(
        accessToken,
        owner,
        repo,
        number,
    );

    const currentUserLogin = (await getAuthenticatedUser(accessToken)).login;
    const userPermission = await getUserRepoPermission(
        accessToken,
        owner,
        repo,
        currentUserLogin,
    ).catch(() => null);
    const pr = await pullRequest;
    const canInteract =
        !pr.locked ||
        userPermission === "admin" ||
        userPermission === "write" ||
        currentUserLogin === pr.user?.login;

    return (
        <Suspense>
            <PullRequestPageContent
                canInteract={canInteract}
                number={number}
                owner={owner}
                pullRequestPromise={pullRequest}
                repo={repo}
            />
        </Suspense>
    );
}

interface PullRequestPageContentProps {
    owner: string;
    repo: string;
    number: number;
    pullRequestPromise: Promise<PullsGetResponseData>;
    canInteract: boolean;
}

function PullRequestPageContent({
    owner,
    repo,
    number,
    pullRequestPromise,
    canInteract,
}: PullRequestPageContentProps) {
    return (
        <div className="px-6 py-8">
            <PullRequestDescriptionSection
                canInteract={canInteract}
                pullRequestPromise={pullRequestPromise}
                owner={owner}
                repo={repo}
                number={number}
            />

            <TimelineSection
                canInteract={canInteract}
                number={number}
                owner={owner}
                repo={repo}
            />
        </div>
    );
}
