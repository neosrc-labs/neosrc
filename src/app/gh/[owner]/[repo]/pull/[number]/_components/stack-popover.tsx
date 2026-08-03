"use client";

import {
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
import type { StackEntry } from "~/server/github";
import { api } from "~/trpc/react";

interface StackPopoverProps {
    owner: string;
    repo: string;
    prNumber: number;
}

function prStateIcon(pr: StackEntry) {
    if (pr.draft) {
        return <GitPullRequestDraft className="size-3.5 text-text-secondary" />;
    }
    if (pr.state === "closed") {
        return (
            <GitPullRequestClosed className="size-3.5 text-text-secondary" />
        );
    }
    // TODO: merged state is not directly available from the stacks API;
    // we infer from closed state. For now, treat all open PRs as open.
    return <GitPullRequest className="size-3.5 text-green-600" />;
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
            <div className="border-border border-b px-4 py-2.5 font-semibold text-sm">
                Stack #{data.number}
            </div>
            <div className="flex flex-col py-1">
                {data.pullRequests.map((pr) => (
                    <Link
                        key={pr.number}
                        href={`/gh/${owner}/${repo}/pull/${pr.number}`}
                        className={cn(
                            "flex items-center gap-2.5 px-4 py-2 text-sm transition-colors hover:bg-surface-selected",
                            prNumber === pr.number && "bg-surface-selected",
                        )}
                    >
                        {prStateIcon(pr)}
                        <span className="shrink-0 font-mono text-text-secondary text-xs">
                            #{pr.number}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                            {pr.title}
                        </span>
                        <span className="shrink-0 font-mono text-text-secondary text-xs">
                            {pr.headRef}
                        </span>
                    </Link>
                ))}
            </div>
            <div className="border-border border-t px-4 py-2 font-mono text-text-secondary text-xs">
                Base: {data.baseRef}
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
