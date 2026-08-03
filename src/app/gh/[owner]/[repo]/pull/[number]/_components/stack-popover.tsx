"use client";

import {
    Circle,
    GitMerge,
    GitPullRequest,
    GitPullRequestClosed,
    GitPullRequestDraft,
    Layers,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import type { StackEntry } from "~/server/github-graphql";
import { api } from "~/trpc/react";

interface StackPopoverProps {
    owner: string;
    repo: string;
    prNumber: number;
}

function StackPopoverContent({ owner, repo, prNumber }: StackPopoverProps) {
    const { data, isLoading } = api.pulls.getStack.useQuery(
        { owner, repo, prNumber },
        { enabled: true },
    );
    if (isLoading) {
        return (
            <div className="flex flex-col gap-2 p-1">
                <div className="h-4 w-24 animate-pulse rounded bg-surface-selected" />
                {["skel-1", "skel-2", "skel-3"].map((key) => (
                    <div
                        key={key}
                        className="h-5 w-48 animate-pulse rounded bg-surface-selected"
                    />
                ))}
                <div className="h-4 w-32 animate-pulse rounded bg-surface-selected" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="p-2 text-text-secondary text-xs">
                Failed to load stack
            </div>
        );
    }
    return (
        <div className="flex min-w-[360px] flex-col">
            <div className="border-border border-b px-4 py-3 font-bold font-semibold text-lg">
                Stack #{data.number}
            </div>
            <div className="flex flex-col">
                {data.pullRequests.map((pr) => (
                    <Link
                        key={pr.number}
                        href={`/gh/${owner}/${repo}/pull/${pr.number}`}
                        className={cn(
                            "flex items-stretch gap-3 px-4 transition-colors hover:bg-surface-selected",
                            prNumber === pr.number && "bg-surface-selected",
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
                        href={`https://github.com/${owner}/${repo}/tree/${data.baseRef}`}
                        className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-blue-800 text-xs hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/30"
                    >
                        {data.baseRef}
                    </a>
                </div>
            </div>
        </div>
    );
}

export function StackBadge({
    owner,
    repo,
    stack,
    prNumber,
}: {
    owner: string;
    repo: string;
    stack: { size: number; position: number; number: number };
    prNumber: number;
}) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="flex cursor-pointer items-center gap-0.5 rounded px-1 py-0.5 text-text-secondary text-xs transition-colors hover:bg-surface-selected hover:text-text"
                >
                    <Layers className="size-3.5" />
                    {stack.position} / {stack.size}
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-auto bg-surface p-0"
                align="start"
                side="bottom"
                sideOffset={6}
            >
                <StackPopoverContent
                    owner={owner}
                    repo={repo}
                    prNumber={prNumber}
                />
            </PopoverContent>
        </Popover>
    );
}

function prCircleFill(pr: StackEntry) {
    if (pr.draft) return "bg-text-secondary";
    if (pr.state === "merged") return "bg-purple-600";
    if (pr.state === "closed") return "bg-red-600";
    return "bg-green-600";
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
