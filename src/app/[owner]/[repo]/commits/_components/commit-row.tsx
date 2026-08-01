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
        <div className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-surface-secondary">
            {/* Subject + meta */}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <Link
                        href={commitUrl}
                        className="truncate font-medium text-sm text-text-primary hover:text-blue-600 dark:hover:text-blue-400"
                    >
                        <CommitSubject message={commit.message} />
                    </Link>
                </div>
            </div>

            {/* Author */}
            <div className="flex shrink-0 items-center gap-3 text-sm text-text-secondary">
                {commit.author ? (
                    <UserLink
                        actor={{
                            login: commit.author.login,
                            avatarUrl: commit.author.avatarUrl,
                        }}
                        provider={provider}
                        showUsername={false}
                    />
                ) : (
                    commit.committerName && (
                        <span className="max-w-[120px] truncate">
                            {commit.committerName}
                        </span>
                    )
                )}
                <span className="w-16 whitespace-nowrap text-right tabular-nums">
                    {relativeTime}
                </span>
            </div>
            {showStatus && commit.statusState && (
                <StatusChecksHoverCard
                    contexts={commit.statusContexts}
                    className="size-4"
                />
            )}

            {/* SHA */}
            <Link
                href={commitUrl}
                className="shrink-0 font-mono text-text-muted text-xs transition-colors hover:text-text-primary"
            >
                {commit.shortSha}
            </Link>
        </div>
    );
}
