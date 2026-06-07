import type { Metadata } from "next";
import { Suspense } from "react";
import { getSession, githubAccessToken } from "~/server/auth";
import {
    type CommitData,
    getCachedCommit,
    getCachedPullRequest,
    getPullRequestCommits,
    type PullsListCommitsResponseData,
} from "~/server/github";
import { generatePRMetadata } from "~/server/metadata";
import {
    CommitHeader,
    CommitHeaderSkeleton,
} from "../../_components/commit-header";
import { FilesSection } from "../../_components/files-client";

interface ChangesPageProps {
    params: Promise<{
        owner: string;
        repo: string;
        number: string;
        sha?: string[];
    }>;
}

export async function generateMetadata({
    params,
}: ChangesPageProps): Promise<Metadata> {
    const { owner, repo, number } = await params;
    return generatePRMetadata(owner, repo, number);
}

export default async function ChangesPage({ params }: ChangesPageProps) {
    const { owner, repo, number: numberStr, sha } = await params;
    const number = parseInt(numberStr, 10);
    const commitSha = sha && sha.length > 0 ? sha[0] : null;

    const accessToken = await githubAccessToken();

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

    const prPromise = getCachedPullRequest(
        accessToken,
        owner,
        repo,
        number,
        userId,
    );

    let commitPromise: Promise<CommitData> | null = null;
    let commitsPromise: Promise<PullsListCommitsResponseData> | null = null;
    if (commitSha) {
        commitPromise = getCachedCommit(
            accessToken,
            owner,
            repo,
            commitSha,
            userId,
        );
        commitsPromise = getPullRequestCommits(
            accessToken,
            owner,
            repo,
            number,
        );
    }

    return (
        <div className="px-6 py-8">
            <Suspense
                fallback={commitSha ? <CommitHeaderSkeleton /> : undefined}
            >
                <CommitHeader
                    commitPromise={commitPromise}
                    commitsPromise={commitsPromise}
                    number={number}
                    owner={owner}
                    repo={repo}
                    commitSha={commitSha ?? null}
                />
            </Suspense>
            <Suspense>
                <FilesSection
                    number={number}
                    owner={owner}
                    repo={repo}
                    commitSha={commitSha ?? undefined}
                    pullRequestPromise={prPromise}
                />
            </Suspense>
        </div>
    );
}
