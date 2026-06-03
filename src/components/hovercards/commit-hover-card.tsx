"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "~/components/ui/hover-card";
import type { Commit } from "~/server/github";
import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/utils";

export function CommitHoverCardContent({
    commit,
    baseUrl,
}: {
    commit: Commit;
    baseUrl: string;
}) {
    const shortSha = commit.sha.slice(0, 7);
    const message = commit.commit.message;
    const subject = message.split("\n")[0];
    const body = message.split("\n").slice(1).join("\n").trim();
    const author = commit.commit.author;
    const authorUser = commit.author;
    const verification = commit.commit.verification;

    return (
        <div>
            <div className="flex items-start gap-3 border-gray-200 border-b p-3 dark:border-zinc-800">
                {authorUser?.avatar_url && (
                    <img
                        alt={authorUser.login}
                        className="mt-0.5 h-8 w-8 shrink-0 rounded-full"
                        src={authorUser.avatar_url}
                    />
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-700 text-xs dark:bg-zinc-800 dark:text-gray-300">
                            {shortSha}
                        </code>
                        {verification?.verified && (
                            <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                        )}
                    </div>
                    {authorUser?.login && (
                        <p className="mt-0.5 font-medium text-gray-900 text-sm dark:text-gray-100">
                            {authorUser.login}
                        </p>
                    )}
                </div>
            </div>
            <div className="flex flex-col gap-1.5 p-3 pt-2.5">
                <p className="font-semibold text-gray-900 text-sm dark:text-gray-100">
                    {subject}
                </p>
                {body && (
                    <p className="whitespace-pre-wrap break-words text-gray-500 text-xs leading-relaxed dark:text-gray-400">
                        {body}
                    </p>
                )}
                {author?.name && author?.date && (
                    <p className="text-gray-500 text-xs dark:text-gray-400">
                        {author.name} authored {formatRelativeTime(author.date)}
                    </p>
                )}
                <Link
                    className="mt-1 text-blue-600 text-xs hover:text-blue-800 hover:underline dark:text-blue-400"
                    href={`${baseUrl}/${commit.sha}`}
                >
                    View →
                </Link>
            </div>
        </div>
    );
}

interface CommitHoverCardProps {
    commit: Commit;
    baseUrl: string;
    children: ReactNode;
}

export function CommitHoverCard({
    commit,
    baseUrl,
    children,
}: CommitHoverCardProps) {
    return (
        <HoverCard openDelay={300}>
            <HoverCardTrigger asChild>{children}</HoverCardTrigger>
            <HoverCardContent className="w-80 bg-white p-0 dark:bg-zinc-950">
                <CommitHoverCardContent commit={commit} baseUrl={baseUrl} />
            </HoverCardContent>
        </HoverCard>
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
                        commit={data.commit as Commit}
                        baseUrl={`https://github.com/${owner}/${repo}/commit`}
                    />
                )}
            </HoverCardContent>
        </HoverCard>
    );
}
