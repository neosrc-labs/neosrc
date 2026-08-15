import Image from "next/image";
import Link from "next/link";
import { CommitAuthors } from "~/components/commit-authors";
import { CommitSubject } from "~/components/commit-subject";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import type { CommitData } from "~/server/github";
import type { GQLCommitWithAuthors } from "~/server/github-graphql";
import { formatRelativeTime } from "~/utils";

interface CommitHeaderProps {
    commitPromise: Promise<CommitData> | null;
    commitsPromise: Promise<GQLCommitWithAuthors[]> | null;
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

    const currentIndex = commitSha
        ? commits.findIndex((c) => c.oid.startsWith(commitSha))
        : -1;
    const prevCommit = currentIndex > 0 ? commits[currentIndex - 1] : null;
    const nextCommit =
        currentIndex >= 0 && currentIndex < commits.length - 1
            ? commits[currentIndex + 1]
            : null;
    return (
        <div className="mb-6 rounded-lg border border-border bg-surface-secondary p-4">
            <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-text-primary">
                    <CommitSubject
                        message={commit.commit.message}
                        provider="gh"
                        owner={owner}
                        repo={repo}
                    />
                    {currentIndex >= 0 && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <span className="cursor-pointer whitespace-nowrap rounded-md px-1.5 py-0.5 font-medium text-sm text-text-secondary tabular-nums transition-colors hover:bg-surface-tertiary">
                                    {currentIndex + 1} / {commits.length}
                                </span>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-80 p-0">
                                <CommitCountList
                                    commits={commits}
                                    currentSha={commitSha}
                                    number={number}
                                    owner={owner}
                                    repo={repo}
                                />
                            </PopoverContent>
                        </Popover>
                    )}
                </h2>
                <div className="flex items-center gap-2">
                    {prevCommit ? (
                        <a
                            className="whitespace-nowrap rounded-md bg-surface-elevated px-3 py-1.5 font-medium text-sm text-text-label ring-1 ring-ring transition-colors hover:bg-gray-50 dark:hover:bg-zinc-700"
                            href={`/gh/${owner}/${repo}/pull/${number}/changes/${prevCommit.oid}`}
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
                            href={`/gh/${owner}/${repo}/pull/${number}/changes/${nextCommit.oid}`}
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
                            <Image
                                alt={commit.author.login}
                                className="h-5 w-5 rounded-full"
                                src={commit.author.avatar_url}
                                width={20}
                                height={20}
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

export function CommitCountList({
    commits,
    owner,
    repo,
    number,
    currentSha,
}: {
    commits: GQLCommitWithAuthors[];
    owner: string;
    repo: string;
    number: number;
    currentSha: string | null;
}) {
    return (
        <div className="max-h-96 overflow-y-auto">
            <p className="border-border-subtle border-b px-3 py-2 font-medium text-text-tertiary text-xs">
                Commits ({commits.length})
            </p>
            <ul className="p-1.5">
                {commits.map((commit) => {
                    const isCurrent = currentSha
                        ? commit.oid.startsWith(currentSha)
                        : false;
                    const author = commit.authors[0];
                    return (
                        <li key={commit.oid}>
                            <Link
                                className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-surface-tertiary ${
                                    isCurrent
                                        ? "border-blue-500 border-l-2 bg-blue-50 dark:bg-blue-950"
                                        : ""
                                }`}
                                href={`/gh/${owner}/${repo}/pull/${number}/changes/${commit.oid}`}
                            >
                                <CommitAuthors
                                    authors={commit.authors}
                                    size={20}
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium text-text-primary">
                                        <CommitSubject
                                            className="truncate"
                                            message={commit.message}
                                            owner={owner}
                                            provider="gh"
                                            repo={repo}
                                        />
                                    </span>
                                    {author && (
                                        <span className="mt-0.5 block font-normal text-text-tertiary text-xs">
                                            {author.user?.login ??
                                                author.name ??
                                                "Unknown"}
                                            {commit.committedDate &&
                                                ` committed ${formatRelativeTime(commit.committedDate)}`}
                                        </span>
                                    )}
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
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
