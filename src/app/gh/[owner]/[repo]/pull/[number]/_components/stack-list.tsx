"use client";

import {
    Circle,
    GitMerge,
    GitPullRequest,
    GitPullRequestClosed,
    GitPullRequestDraft,
} from "lucide-react";
import Link from "next/link";
import { cn } from "~/lib/utils";
import type { StackEntry } from "~/server/github-graphql";

interface StackListProps {
    owner: string;
    repo: string;
    items: StackEntry[];
    baseRef: string;
    currentNumber?: number;
}

export function StackList({
    owner,
    repo,
    items,
    baseRef,
    currentNumber,
}: StackListProps) {
    return (
        <div className="flex flex-col">
            {items.map((pr) => (
                <Link
                    key={pr.number}
                    href={`/gh/${owner}/${repo}/pull/${pr.number}`}
                    className={cn(
                        "flex items-stretch gap-3 px-4 transition-colors hover:bg-surface-selected",
                        currentNumber === pr.number && "bg-surface-selected",
                    )}
                >
                    <div className="flex shrink-0 flex-col items-center self-stretch">
                        <div className="w-0.5 flex-1 rounded-full bg-text-secondary/25" />
                        <span
                            className={cn(
                                "flex size-5 items-center justify-center rounded-full ring-1 ring-border",
                                prCircleFill(pr),
                            )}
                        >
                            <PrStateIcon pr={pr} />
                        </span>
                        <div className="w-0.5 flex-1 rounded-full bg-text-secondary/25" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col py-2">
                        <span className="truncate font-bold text-sm leading-snug">
                            {pr.title}
                        </span>
                        <span className="pt-1 font-mono text-text-secondary text-xs">
                            #{pr.number} · {pr.headRef}
                        </span>
                    </div>
                </Link>
            ))}
            <div className="flex items-center gap-3 px-4 pb-1">
                <div className="flex shrink-0 flex-col items-center">
                    <div className="h-4 w-0.5 rounded-full bg-text-secondary/25" />
                    <span className="flex size-5 items-center justify-center rounded-full bg-surface ring-1 ring-border">
                        <Circle className="size-2.5 fill-text-secondary/25 text-text-secondary" />
                    </span>
                    <div className="h-3 w-0.5" />
                </div>
                <a
                    href={`https://github.com/${owner}/${repo}/tree/${baseRef}`}
                    className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-blue-800 text-xs hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/30"
                >
                    {baseRef}
                </a>
            </div>
        </div>
    );
}

function prCircleFill(pr: StackEntry) {
    if (pr.draft) return "bg-state-draft";
    if (pr.state === "merged") return "bg-state-merged";
    if (pr.state === "closed") return "bg-state-closed";
    return "bg-state-open";
}

function PrStateIcon({ pr }: { pr: StackEntry }) {
    if (pr.draft)
        return <GitPullRequestDraft className="size-3.5 text-text-inverse" />;
    if (pr.state === "merged")
        return <GitMerge className="size-3.5 text-text-inverse" />;
    if (pr.state === "closed")
        return <GitPullRequestClosed className="size-3.5 text-text-inverse" />;
    return <GitPullRequest className="size-3.5 text-text-inverse" />;
}
