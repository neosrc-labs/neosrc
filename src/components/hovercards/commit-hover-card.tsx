"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { CommitAuthors } from "~/components/commit-authors";
import { CommitSubject } from "~/components/commit-subject";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "~/components/ui/hover-card";
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
            <div className="flex items-start gap-3 border-gray-200 border-b p-3 dark:border-zinc-800">
                <CommitAuthors authors={commit.authors} size={32} />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-700 text-xs dark:bg-zinc-800 dark:text-zinc-300">
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
                        <p className="mt-0.5 font-medium text-gray-900 text-sm dark:text-zinc-100">
                            {primaryAuthor.user?.login ??
                                primaryAuthor.name ??
                                "Unknown"}
                        </p>
                    )}
                </div>
            </div>
            <div className="flex flex-col gap-1.5 p-3 pt-2.5">
                <p className="font-semibold text-gray-900 text-sm dark:text-zinc-100">
                    <CommitSubject message={commit.message} />
                </p>
                {body && (
                    <p className="whitespace-pre-wrap break-words text-gray-500 text-xs leading-relaxed dark:text-zinc-400">
                        {body}
                    </p>
                )}
                {primaryAuthor?.name && commit.committedDate && (
                    <p className="text-gray-500 text-xs dark:text-zinc-400">
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
    const [open, setOpen] = useState(false);
    const [hasBeenHovered, setHasBeenHovered] = useState(false);

    const { data } = api.commits.getBySha.useQuery(
        { owner, repo, sha },
        {
            staleTime: 5 * 60 * 1000,
            enabled: hasBeenHovered,
        },
    );

    const showCard = open && !!data;

    return (
        <HoverCard
            open={showCard}
            onOpenChange={(isOpen) => {
                setOpen(isOpen);
                if (isOpen) {
                    setHasBeenHovered(true);
                }
            }}
        >
            <HoverCardTrigger asChild>{children}</HoverCardTrigger>
            <HoverCardContent className="w-80 bg-white p-0 dark:bg-zinc-950">
                {data && (
                    <CommitHoverCardContent
                        commit={data.commit}
                        baseUrl={`https://github.com/${owner}/${repo}/commit`}
                    />
                )}
            </HoverCardContent>
        </HoverCard>
    );
}
