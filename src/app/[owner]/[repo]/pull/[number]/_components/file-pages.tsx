import { Suspense } from "react";
import type { PullRequestFile } from "~/server/github";
import { createOctokit, getCachedCommit, getCommit } from "~/server/github";
import { FileBatch } from "./file-batch";

interface FilePagesProps {
    accessToken: string;
    owner: string;
    repo: string;
    pullNumber: number;
    commitSha?: string;
    userId?: string;
    page?: number;
}

export async function FilePages({
    accessToken,
    owner,
    repo,
    pullNumber,
    commitSha,
    userId,
    page = 1,
}: FilePagesProps) {
    let files: PullRequestFile[];

    if (commitSha && page === 1) {
        const commit = userId
            ? await getCachedCommit(accessToken, owner, repo, commitSha, userId)
            : await getCommit(accessToken, owner, repo, commitSha);
        files = commit.files ?? [];
    } else {
        const octokit = createOctokit(accessToken);
        const response = await octokit.pulls.listFiles({
            owner,
            repo,
            pull_number: pullNumber,
            per_page: 100,
            page,
        });
        files = response.data;
    }

    const hasNext = !commitSha && files.length >= 30;

    return (
        <>
            <FileBatch
                files={files}
                owner={owner}
                repo={repo}
                number={String(pullNumber)}
                page={page}
            />
            {hasNext && (
                <Suspense fallback={<FileBatchSkeleton />}>
                    <FilePages
                        accessToken={accessToken}
                        owner={owner}
                        repo={repo}
                        pullNumber={pullNumber}
                        commitSha={commitSha}
                        userId={userId}
                        page={page + 1}
                    />
                </Suspense>
            )}
        </>
    );
}

function FileBatchSkeleton() {
    return (
        <>
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className="mb-6 overflow-hidden rounded border border-gray-200 dark:border-zinc-700"
                >
                    <div className="flex items-center gap-2 border-gray-200 border-b bg-gray-50 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-900">
                        <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                    </div>
                    <div className="bg-white p-4 dark:bg-zinc-950">
                        <div className="space-y-2">
                            <div className="h-3.5 w-5/6 animate-pulse rounded bg-gray-100 dark:bg-zinc-800" />
                            <div className="h-3.5 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-zinc-800" />
                            <div className="h-3.5 w-3/4 animate-pulse rounded bg-gray-100 dark:bg-zinc-800" />
                        </div>
                    </div>
                </div>
            ))}
        </>
    );
}
