import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getSession, githubAccessToken } from "~/server/auth";
import {
    type CommitData,
    getCachedCommit,
    getCachedPullRequest,
    getChecksForCommit,
    getConflictedFiles,
    getUserRepoPermission,
} from "~/server/github";
import {
    type GQLCommitWithAuthors,
    getAllPullRequestCommitsGraphQL,
} from "~/server/github-graphql";
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
    const number = Number(numberStr);

    if (
        !/^[0-9]+$/.test(numberStr) ||
        !Number.isInteger(number) ||
        number < 1
    ) {
        notFound();
        return;
    }

    const commitSha = sha && sha.length > 0 ? sha[0] : null;

    const accessToken = await githubAccessToken();

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

    const prPromise = getCachedPullRequest(
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

    const conflictedFilesPromise = prPromise.then(async (pr) => {
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

    const checksPromise = prPromise.then((pr) =>
        getChecksForCommit(accessToken, owner, repo, pr.head.sha),
    );

    let commitPromise: Promise<CommitData> | null = null;
    let commitsPromise: Promise<GQLCommitWithAuthors[]> | null = null;
    if (commitSha) {
        commitPromise = getCachedCommit(
            accessToken,
            owner,
            repo,
            commitSha,
            userId,
        );
        commitsPromise = getAllPullRequestCommitsGraphQL(
            accessToken,
            owner,
            repo,
            number,
        );
    }

    return (
        <div className="px-6 pb-8">
            {commitSha && (
                <div className="pt-8">
                    <Suspense fallback={<CommitHeaderSkeleton />}>
                        <CommitHeader
                            commitPromise={commitPromise}
                            commitsPromise={commitsPromise}
                            number={number}
                            owner={owner}
                            repo={repo}
                            commitSha={commitSha}
                        />
                    </Suspense>
                </div>
            )}
            <Suspense>
                <FilesSection
                    number={number}
                    owner={owner}
                    repo={repo}
                    commitSha={commitSha ?? undefined}
                    pullRequestPromise={prPromise}
                    currentUserLogin={currentUserLogin}
                    userPermissionPromise={userPermissionPromise}
                    conflictedFilesPromise={conflictedFilesPromise}
                    checkRunsPromise={checksPromise}
                />
            </Suspense>
        </div>
    );
}
