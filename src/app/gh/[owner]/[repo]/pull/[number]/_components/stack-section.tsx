"use client";

import { Circle, Layers } from "lucide-react";
import Link from "next/link";
import { cn } from "~/lib/utils";
import type { StackEntry } from "~/server/github-graphql";
import { api } from "~/trpc/react";
import { PrStateIcon, prCircleFill } from "./stack-list";

type Mergeability =
    | "merged"
    | "closed"
    | "draft"
    | "conflicts"
    | "blocked"
    | "ready";

interface StackSectionProps {
    owner: string;
    repo: string;
    prNumber: number;
}

export function StackSection({ owner, repo, prNumber }: StackSectionProps) {
    const { data: stackData, isLoading } = api.pulls.getStack.useQuery(
        { owner, repo, prNumber },
        { enabled: true },
    );

    if (isLoading || !stackData) {
        return null;
    }

    // Entries from API: top-first (position descending). Reverse to iterate base-first.
    const entries = [...stackData.pullRequests].reverse();

    const mergeabilityByNumber = computeMergeabilityMap(entries);

    return (
        <div className="flex flex-shrink-0 flex-col border-gray-200 border-t pt-3 dark:border-zinc-700">
            <div className="flex items-center gap-2 px-3 pb-2">
                <Layers className="size-4 text-text-secondary" />
                <span className="font-semibold text-text-secondary text-xs uppercase tracking-wide">
                    Stack
                </span>
                <span className="rounded-full bg-surface-secondary px-1.5 py-px font-medium text-text-tertiary text-xs">
                    {stackData.pullRequests.length}
                </span>
            </div>
            <div className="flex flex-col">
                {stackData.pullRequests.map((pr) => (
                    <Link
                        key={pr.number}
                        href={`/gh/${owner}/${repo}/pull/${pr.number}`}
                        className={cn(
                            "flex items-stretch gap-2.5 px-3 transition-colors hover:bg-surface-selected",
                            prNumber === pr.number && "bg-surface-selected",
                        )}
                    >
                        <div className="flex shrink-0 flex-col items-center self-stretch">
                            <div className="w-0.5 flex-1 rounded-full bg-text-secondary/25" />
                            <span
                                className={cn(
                                    "flex size-4 items-center justify-center rounded-full ring-1 ring-border",
                                    prCircleFill(pr),
                                )}
                            >
                                <PrStateIcon pr={pr} />
                            </span>
                            <div className="w-0.5 flex-1 rounded-full bg-text-secondary/25" />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col py-1.5">
                            <span className="truncate font-medium text-sm leading-snug">
                                {pr.title}
                            </span>
                            <span className="pt-0.5 font-mono text-text-secondary text-xs">
                                #{pr.number} · {pr.headRef}
                            </span>
                        </div>
                        <div className="flex shrink-0 items-center self-center pl-1">
                            <MergeabilityBadge
                                label={
                                    mergeabilityByNumber[pr.number] ?? "ready"
                                }
                            />
                        </div>
                    </Link>
                ))}
                {/* Base branch indicator */}
                <div className="flex items-center gap-2.5 px-3 pb-1">
                    <div className="flex shrink-0 flex-col items-center">
                        <div className="h-3 w-0.5 rounded-full bg-text-secondary/25" />
                        <span className="flex size-4 items-center justify-center rounded-full bg-surface ring-1 ring-border">
                            <Circle className="size-2 fill-text-secondary/25 text-text-secondary" />
                        </span>
                        <div className="h-2 w-0.5" />
                    </div>
                    <a
                        href={`https://github.com/${owner}/${repo}/tree/${stackData.baseRef}`}
                        className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-blue-800 text-xs hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/30"
                    >
                        {stackData.baseRef}
                    </a>
                </div>
            </div>
        </div>
    );
}

function computeMergeabilityMap(
    ascending: StackEntry[],
): Record<number, Mergeability> {
    const result: Record<number, Mergeability> = {};
    ascending.forEach((entry, i) => {
        if (entry.state === "merged") {
            result[entry.number] = "merged";
        } else if (entry.state === "closed") {
            result[entry.number] = "closed";
        } else if (entry.draft) {
            result[entry.number] = "draft";
        } else if (entry.mergeable === "CONFLICTING") {
            result[entry.number] = "conflicts";
        } else {
            const earlier = ascending.slice(0, i);
            if (earlier.some((e) => e.mergeable === "CONFLICTING")) {
                result[entry.number] = "blocked";
            } else if (earlier.some((e) => e.state !== "merged")) {
                result[entry.number] = "blocked";
            } else {
                result[entry.number] = "ready";
            }
        }
    });
    return result;
}

function MergeabilityBadge({ label }: { label: Mergeability }) {
    const style = BADGE_STYLES[label];
    return (
        <span
            className={cn(
                "truncate rounded-full border px-2 py-px font-medium text-xs leading-relaxed",
                style.bg,
                style.border,
                style.text,
            )}
        >
            {style.label}
        </span>
    );
}

const BADGE_STYLES: Record<
    Mergeability,
    { label: string; bg: string; border: string; text: string }
> = {
    merged: {
        label: "Merged",
        bg: "bg-purple-50 dark:bg-purple-500/10",
        border: "border-purple-200 dark:border-purple-500/30",
        text: "text-purple-700 dark:text-purple-300",
    },
    closed: {
        label: "Closed",
        bg: "bg-red-50 dark:bg-red-500/10",
        border: "border-red-200 dark:border-red-500/30",
        text: "text-red-700 dark:text-red-300",
    },
    draft: {
        label: "Draft",
        bg: "bg-zinc-100 dark:bg-zinc-500/10",
        border: "border-zinc-200 dark:border-zinc-500/30",
        text: "text-zinc-600 dark:text-zinc-400",
    },
    conflicts: {
        label: "Conflicts",
        bg: "bg-red-50 dark:bg-red-500/10",
        border: "border-red-200 dark:border-red-500/30",
        text: "text-red-700 dark:text-red-300",
    },
    blocked: {
        label: "Blocked",
        bg: "bg-amber-50 dark:bg-amber-500/10",
        border: "border-amber-200 dark:border-amber-500/30",
        text: "text-amber-700 dark:text-amber-300",
    },
    ready: {
        label: "Ready",
        bg: "bg-green-50 dark:bg-green-500/10",
        border: "border-green-200 dark:border-green-500/30",
        text: "text-green-700 dark:text-green-300",
    },
};
