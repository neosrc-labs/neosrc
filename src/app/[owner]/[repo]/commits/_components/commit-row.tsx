"use client";

import Link from "next/link";
import { StatusChecksHoverCard } from "~/components/ci-status";
import { CommitSubject } from "~/components/commit-subject";
import { UserLink } from "~/components/user-link";
import type { CommitListItem } from "~/server/api/routers/commits/types";
import { formatRelativeTime } from "~/utils";

interface CommitRowProps {
    commit: CommitListItem;
    owner: string;
    repo: string;
    provider: "gh" | "cb";
    showStatus: boolean;
}

export function CommitRow({
    commit,
    owner,
    repo,
    provider,
    showStatus,
}: CommitRowProps) {
    const commitUrl = `/${provider === "gh" ? "gh" : "cb"}/${owner}/${repo}/commit/${commit.sha}`;
    const relativeTime = formatRelativeTime(commit.committedDate);

    return (
        <div className="flex flex-col gap-1 px-4 py-2 transition-colors hover:bg-surface-secondary">
            {/* Subject */}
            <div className="min-w-0">
                <Link
                    href={commitUrl}
                    className="font-medium text-sm text-text-primary hover:text-blue-600 dark:hover:text-blue-400"
                >
                    <CommitSubject message={commit.message} />
                </Link>
            </div>

            {/* Meta row: author, timestamp, CI, SHA */}
            <div className="flex items-center gap-2 text-text-secondary text-xs">
                {commit.author ? (
                    <UserLink
                        actor={{
                            login: commit.author.login,
                            avatarUrl: commit.author.avatarUrl,
                        }}
                        provider={provider}
                    />
                ) : (
                    commit.committerName && (
                        <span className="max-w-[120px] truncate">
                            {commit.committerName}
                        </span>
                    )
                )}
                <span>committed</span>
                <span className="whitespace-nowrap">{relativeTime}</span>
                {showStatus && commit.statusState && (
                    <StatusChecksHoverCard
                        contexts={commit.statusContexts}
                        className="size-3.5"
                    />
                )}
                <Link
                    href={commitUrl}
                    className="ml-auto font-mono text-text-muted transition-colors hover:text-text-primary"
                >
                    {commit.shortSha}
                </Link>
            </div>
        </div>
    );
}
