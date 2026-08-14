import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { PullChangesPageParams } from "~/app/[owner]/[repo]/_components/repo-pages/changes-page-params";
import { getSession, githubAccessToken } from "~/server/auth";
import {
    type CommitData,
    getCachedCommit,
    getCachedPullRequest,
    getChecksForCommit,
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
import {
    buildConflictedFilesPromise,
    SignedOutNotice,
} from "../../_components/pull-page-data";
import { getPullRequestPermissionContext } from "../../permissions-server";

interface ChangesPageProps {
    params: Promise<PullChangesPageParams>;
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
        return <SignedOutNotice />;
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

    const permissionContextPromise = getPullRequestPermissionContext(
        accessToken,
        owner,
        repo,
        prPromise,
        userId,
    );

    const conflictedFilesPromise = buildConflictedFilesPromise(
        accessToken,
        owner,
        repo,
        prPromise,
    );

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
                    permissionContextPromise={permissionContextPromise}
                    conflictedFilesPromise={conflictedFilesPromise}
                    checkRunsPromise={checksPromise}
                />
            </Suspense>
        </div>
    );
}
