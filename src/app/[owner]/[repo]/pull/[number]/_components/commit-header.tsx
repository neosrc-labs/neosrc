import type { CommitData, PullsListCommitsResponseData } from "~/server/github";

interface CommitHeaderProps {
    commitPromise: Promise<CommitData> | null;
    commitsPromise: Promise<PullsListCommitsResponseData> | null;
    owner: string;
    repo: string;
    number: number;
    commitSha: string | null;
}

export async function CommitHeader({
    commitPromise,
    commitsPromise,
    owner,
    repo,
    number,
    commitSha,
}: CommitHeaderProps) {
    if (commitPromise == null || commitsPromise == null) {
        return null;
    }

    const commit = await commitPromise;
    const commits = await commitsPromise;

    const currentIndex = commits.findIndex((c) => c.sha === commitSha);
    const prevCommit = currentIndex > 0 ? commits[currentIndex - 1] : null;
    const nextCommit =
        currentIndex >= 0 && currentIndex < commits.length - 1
            ? commits[currentIndex + 1]
            : null;
    return (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 text-lg dark:text-gray-100">
                    {commit.commit.message.split("\n")[0]}
                </h2>
                <div className="flex gap-2">
                    {prevCommit ? (
                        <a
                            className="whitespace-nowrap rounded-md bg-white px-3 py-1.5 font-medium text-gray-700 text-sm ring-1 ring-gray-300 transition-colors hover:bg-gray-50 dark:bg-zinc-800 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-zinc-700"
                            href={`/${owner}/${repo}/pull/${number}/changes/${prevCommit.sha}`}
                        >
                            ← Previous
                        </a>
                    ) : (
                        <button
                            className="cursor-not-allowed rounded-md bg-gray-100 px-3 py-1.5 font-medium text-gray-400 text-sm ring-1 ring-gray-200 dark:bg-zinc-800 dark:text-gray-500 dark:ring-zinc-700"
                            disabled
                            type="button"
                        >
                            ← Previous
                        </button>
                    )}
                    {nextCommit ? (
                        <a
                            className="whitespace-nowrap rounded-md bg-white px-3 py-1.5 font-medium text-gray-700 text-sm ring-1 ring-gray-300 transition-colors hover:bg-gray-50 dark:bg-zinc-800 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-zinc-700"
                            href={`/${owner}/${repo}/pull/${number}/changes/${nextCommit.sha}`}
                        >
                            Next →
                        </a>
                    ) : (
                        <button
                            className="cursor-not-allowed rounded-md bg-gray-100 px-3 py-1.5 font-medium text-gray-400 text-sm ring-1 ring-gray-200 dark:bg-zinc-800 dark:text-gray-500 dark:ring-zinc-700"
                            disabled
                            type="button"
                        >
                            Next →
                        </button>
                    )}
                </div>
            </div>
            {commit.commit.message.split("\n").length > 1 && (
                <p className="whitespace-pre-wrap text-gray-600 text-sm dark:text-gray-400">
                    {commit.commit.message
                        .split("\n")
                        .slice(1)
                        .join("\n")
                        .trim()}
                </p>
            )}
            <div className="mt-3 flex items-center gap-2">
                {commit.author ? (
                    <>
                        <a
                            className="flex items-center gap-2"
                            href={commit.author.html_url}
                            rel="noopener noreferrer"
                            target="_blank"
                        >
                            <img
                                alt={commit.author.login}
                                className="h-5 w-5 rounded-full"
                                src={commit.author.avatar_url}
                            />
                        </a>

                        <a
                            className="flex items-center gap-2"
                            href={commit.author.html_url}
                            rel="noopener noreferrer"
                            target="_blank"
                        >
                            <span className="text-gray-600 text-sm hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">
                                {commit.author.login}
                            </span>
                        </a>
                        <span className="text-gray-600 text-sm dark:text-gray-400">
                            committed{" "}
                            {new Date(
                                commit.commit.committer?.date || "",
                            ).toLocaleDateString()}
                        </span>
                    </>
                ) : (
                    <span className="text-gray-600 text-sm">
                        {commit.commit.author?.name} committed{" "}
                        {new Date(
                            commit.commit.committer?.date || "",
                        ).toLocaleDateString()}
                    </span>
                )}
                <code className="ml-2 font-mono text-gray-500 text-xs dark:text-gray-400">
                    {commit.sha.slice(0, 7)}
                </code>
            </div>
        </div>
    );
}

export function CommitHeaderSkeleton() {
    return (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-3 h-8 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
            <div className="mt-3 flex items-center gap-2">
                <div className="h-5 w-5 animate-pulse rounded-full bg-gray-200 dark:bg-zinc-700" />
                <div className="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
            </div>
        </div>
    );
}
