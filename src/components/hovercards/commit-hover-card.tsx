"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CommitAuthors } from "~/components/commit-authors";
import { CommitSubject } from "~/components/commit-subject";
import {
    LazyHoverCard,
    useLazyHoverCardState,
} from "~/components/hovercards/hover-card-shared";
import { VerifiedBadgeInline } from "~/components/verified-badge";
import type { GQLCommitWithAuthors } from "~/server/github-graphql";
import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/utils";

function CommitHoverCardContent({
    commit,
    baseUrl,
}: {
    commit: GQLCommitWithAuthors;
    baseUrl: string;
}) {
    const shortSha = commit.oid.slice(0, 7);
    const body = commit.message.split("\n").slice(1).join("\n").trim();
    const primaryAuthor = commit.authors[0];
    return (
        <div>
            <div className="flex items-start gap-3 border-border-subtle border-b p-3">
                <CommitAuthors authors={commit.authors} size={32} />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <code className="rounded bg-surface-tertiary px-1.5 py-0.5 font-mono text-text-label text-xs">
                            {shortSha}
                        </code>
                        {commit.signature && (
                            <VerifiedBadgeInline signature={commit.signature}>
                                <span className="text-green-600 text-xs dark:text-green-400">
                                    ✓
                                </span>
                            </VerifiedBadgeInline>
                        )}
                    </div>
                    {primaryAuthor && (
                        <p className="mt-0.5 font-medium text-sm text-text-primary">
                            {primaryAuthor.user?.login ??
                                primaryAuthor.name ??
                                "Unknown"}
                        </p>
                    )}
                </div>
            </div>
            <div className="flex flex-col gap-1.5 p-3 pt-2.5">
                <p className="font-semibold text-sm text-text-primary">
                    <CommitSubject message={commit.message} />
                </p>
                {body && (
                    <p className="whitespace-pre-wrap break-words text-text-tertiary text-xs leading-relaxed">
                        {body}
                    </p>
                )}
                {primaryAuthor?.name && commit.committedDate && (
                    <p className="text-text-tertiary text-xs">
                        {primaryAuthor.name} authored{" "}
                        {formatRelativeTime(commit.committedDate)}
                    </p>
                )}
                <Link
                    className="mt-1 text-blue-600 text-xs hover:text-blue-800 hover:underline dark:text-blue-400"
                    href={`${baseUrl}/${commit.oid}`}
                >
                    View →
                </Link>
            </div>
        </div>
    );
}

interface MarkdownCommitHoverCardProps {
    owner: string;
    repo: string;
    sha: string;
    children: ReactNode;
}

export function MarkdownCommitHoverCard({
    owner,
    repo,
    sha,
    children,
}: MarkdownCommitHoverCardProps) {
    const { open, hasBeenHovered, handleOpenChange } = useLazyHoverCardState();

    const { data } = api.commits.getBySha.useQuery(
        { owner, repo, sha },
        {
            staleTime: 5 * 60 * 1000,
            enabled: hasBeenHovered,
        },
    );

    return (
        <LazyHoverCard
            open={open && !!data}
            onOpenChange={handleOpenChange}
            content={
                data && (
                    <CommitHoverCardContent
                        commit={data.commit}
                        baseUrl={`https://github.com/${owner}/${repo}/commit`}
                    />
                )
            }
        >
            {children}
        </LazyHoverCard>
    );
}
