"use client";

import { Check, Copy, FolderOpen } from "lucide-react";
import { useCallback, useState } from "react";
import {
    computeStatusState,
    StatusCheckIcon,
    StatusContextRow,
} from "~/components/ci-status";
import { CommitSubject } from "~/components/commit-subject";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "~/components/ui/hover-card";
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
    const externalCommitUrl =
        provider === "gh"
            ? `https://github.com/${owner}/${repo}/commit/${commit.sha}`
            : `https://codeberg.org/${owner}/${repo}/commit/${commit.sha}`;
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
        "inline-flex items-center justify-center size-4 shrink-0 cursor-pointer text-text-muted transition-colors hover:text-text-primary";

    return (
        <div className="flex items-center gap-2 px-4 py-2 transition-colors hover:bg-surface-secondary">
            {/* Left: subject + meta */}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <a
                    href={externalCommitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 truncate font-medium text-sm text-text-primary hover:text-blue-600 dark:hover:text-blue-400"
                >
                    <CommitSubject message={commit.message} />
                </a>

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
                    <span>
                        committed{" "}
                        <span
                            className="whitespace-nowrap"
                            title={commit.committedDate}
                        >
                            {relativeTime}
                        </span>
                    </span>
                    {showStatus &&
                        commit.statusState &&
                        (() => {
                            const rollup = computeStatusState(
                                commit.statusContexts,
                            );
                            if (!rollup) return null;
                            return (
                                <HoverCard openDelay={200}>
                                    <HoverCardTrigger asChild>
                                        <button
                                            type="button"
                                            className="inline-flex cursor-pointer items-center gap-1"
                                            tabIndex={-1}
                                        >
                                            <StatusCheckIcon
                                                state={rollup}
                                                className="size-3.5"
                                            />
                                            <span className="tabular-nums">
                                                {
                                                    commit.statusContexts.filter(
                                                        (c) =>
                                                            c.state ===
                                                            "SUCCESS",
                                                    ).length
                                                }
                                                {" / "}
                                                {commit.statusContexts.length}
                                            </span>
                                        </button>
                                    </HoverCardTrigger>
                                    <HoverCardContent
                                        align="start"
                                        side="bottom"
                                        className="w-72 bg-surface p-0"
                                    >
                                        <div className="border-border-subtle border-b px-3 py-2">
                                            <div className="font-medium text-xs">
                                                {commit.statusState ===
                                                "SUCCESS"
                                                    ? "All checks have passed"
                                                    : "Some checks were not successful"}
                                            </div>
                                        </div>
                                        <div className="max-h-80 space-y-1.5 overflow-y-auto p-3">
                                            {commit.statusContexts.map(
                                                (ctx) => (
                                                    <StatusContextRow
                                                        key={ctx.name}
                                                        context={ctx}
                                                    />
                                                ),
                                            )}
                                        </div>
                                    </HoverCardContent>
                                </HoverCard>
                            );
                        })()}
                </div>
            </div>

            {/* Right: verified badge, hash, copy, browse */}
            <span className="flex shrink-0 items-center gap-3">
                {commit.signature?.isValid && (
                    <VerifiedBadge
                        signature={commit.signature as GQLGitSignature}
                    />
                )}
                <a
                    href={externalCommitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-text-muted text-xs transition-colors hover:text-text-primary"
                >
                    {commit.shortSha}
                </a>
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
