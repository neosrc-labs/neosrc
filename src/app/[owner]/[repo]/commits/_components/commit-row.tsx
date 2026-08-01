"use client";

import { Check, Copy, FolderOpen } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { StatusChecksHoverCard } from "~/components/ci-status";
import { CommitSubject } from "~/components/commit-subject";
import { UserLink } from "~/components/user-link";
import { VerifiedBadge } from "~/components/verified-badge";
import type { CommitListItem } from "~/server/api/routers/commits/types";
import type { GQLGitSignature } from "~/server/github-graphql";
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
    const treeUrl =
        provider === "gh"
            ? `https://github.com/${owner}/${repo}/tree/${commit.sha}`
            : `https://codeberg.org/${owner}/${repo}/src/commit/${commit.sha}`;
    const relativeTime = formatRelativeTime(commit.committedDate);
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(commit.sha).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [commit.sha]);

    const iconBase =
        "inline-flex items-center justify-center size-4 shrink-0 text-text-muted transition-colors hover:text-text-primary";

    return (
        <div className="flex items-center gap-2 px-4 py-2 transition-colors hover:bg-surface-secondary">
            {/* Left: subject + meta */}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Link
                    href={commitUrl}
                    className="min-w-0 truncate font-medium text-sm text-text-primary hover:text-blue-600 dark:hover:text-blue-400"
                >
                    <CommitSubject message={commit.message} />
                </Link>

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
                </div>
            </div>

            {/* Right: verified badge, hash, copy, browse */}
            <span className="flex shrink-0 items-center gap-3">
                {commit.signature?.isValid && (
                    <VerifiedBadge
                        signature={commit.signature as GQLGitSignature}
                    />
                )}
                <Link
                    href={commitUrl}
                    className="font-mono text-text-muted text-xs transition-colors hover:text-text-primary"
                >
                    {commit.shortSha}
                </Link>
                <button
                    type="button"
                    onClick={handleCopy}
                    className={iconBase}
                    aria-label="Copy full SHA"
                >
                    {copied ? (
                        <Check className="text-green-500" size={16} />
                    ) : (
                        <Copy size={16} />
                    )}
                </button>
                <a
                    href={treeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={iconBase}
                    aria-label="Browse files at this commit"
                >
                    <FolderOpen size={16} />
                </a>
            </span>
        </div>
    );
}
