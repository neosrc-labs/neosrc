import { CommitSubject } from "~/components/commit-subject";
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
        <div className="mb-6 rounded-lg border border-border bg-surface-secondary p-4">
            <div className="mb-3 flex items-center justify-between">
                <h2 className="text-text-primary">
                    <CommitSubject message={commit.commit.message} />
                </h2>
                <div className="flex gap-2">
                    {prevCommit ? (
                        <a
                            className="whitespace-nowrap rounded-md bg-surface-elevated px-3 py-1.5 font-medium text-sm text-text-label ring-1 ring-ring transition-colors hover:bg-gray-50 dark:hover:bg-zinc-700"
                            href={`/gh/${owner}/${repo}/pull/${number}/files/${prevCommit.sha}`}
                        >
                            ← Previous
                        </a>
                    ) : (
                        <button
                            className="cursor-not-allowed rounded-md bg-surface-tertiary px-3 py-1.5 font-medium text-sm text-text-muted ring-1 ring-border"
                            disabled
                            type="button"
                        >
                            ← Previous
                        </button>
                    )}
                    {nextCommit ? (
                        <a
                            className="whitespace-nowrap rounded-md bg-surface-elevated px-3 py-1.5 font-medium text-sm text-text-label ring-1 ring-ring transition-colors hover:bg-gray-50 dark:hover:bg-zinc-700"
                            href={`/gh/${owner}/${repo}/pull/${number}/files/${nextCommit.sha}`}
                        >
                            Next →
                        </a>
                    ) : (
                        <button
                            className="cursor-not-allowed rounded-md bg-surface-tertiary px-3 py-1.5 font-medium text-sm text-text-muted ring-1 ring-border"
                            disabled
                            type="button"
                        >
                            Next →
                        </button>
                    )}
                </div>
            </div>
            {commit.commit.message.split("\n").length > 1 && (
                <p className="whitespace-pre-wrap text-sm text-text-secondary">
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
                            <span className="text-sm text-text-secondary hover:text-text-primary dark:hover:text-zinc-200">
                                {commit.author.login}
                            </span>
                        </a>
                        <span className="text-sm text-text-secondary">
                            committed{" "}
                            {new Date(
                                commit.commit.committer?.date || "",
                            ).toLocaleDateString()}
                        </span>
                    </>
                ) : (
                    <span className="text-sm text-text-secondary">
                        {commit.commit.author?.name} committed{" "}
                        {new Date(
                            commit.commit.committer?.date || "",
                        ).toLocaleDateString()}
                    </span>
                )}
                <code className="ml-2 font-mono text-text-tertiary text-xs">
                    {commit.sha.slice(0, 7)}
                </code>
            </div>
        </div>
    );
}

export function CommitHeaderSkeleton() {
    return (
        <div className="mb-6 rounded-lg border border-border bg-surface-secondary p-4">
            <div className="mb-3 h-8 w-3/4 animate-pulse rounded bg-surface-selected" />
            <div className="mt-3 flex items-center gap-2">
                <div className="h-5 w-5 animate-pulse rounded-full bg-surface-selected" />
                <div className="h-4 w-32 animate-pulse rounded bg-surface-selected" />
            </div>
        </div>
    );
}
