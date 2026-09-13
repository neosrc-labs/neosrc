"use client";

import { Check, Circle } from "lucide-react";
import { use, useRef, useState } from "react";
import { MetadataSection } from "~/app/[owner]/[repo]/_components/metadata-section";
import type { PullRequestPermissionContext } from "~/app/[owner]/[repo]/_components/permissions-utils";
import { StatusCheckIcon } from "~/components/ci-status";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "~/components/ui/tooltip";
import type { CheckRun, PullsGetResponseData } from "~/server/github";
import { api } from "~/trpc/react";
import { computeChecksPollingInterval } from "~/utils/checks-polling";
import { checkBreakdown } from "./check-groups";
import { ChecksSection } from "./checks-section";
import { CommitsSection } from "./commits-section";

interface RightSidebarProps {
    pullRequestPromise: Promise<PullsGetResponseData> | null;
    checksPromise: Promise<Array<CheckRun>> | null;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
    owner: string;
    repo: string;
    number: number;
}

function ChecksRing({
    checks,
    className,
}: {
    checks: CheckRun[];
    className?: string;
}) {
    const total = checks.length;
    const segments = checkBreakdown(checks);

    let offset = 0;
    return (
        <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
            <circle
                cx="18"
                cy="18"
                r="15.9155"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-border-subtle"
            />
            {segments.map((segment) => {
                const pct = (segment.count / total) * 100;
                const arc = (
                    <circle
                        key={segment.label}
                        cx="18"
                        cy="18"
                        r="15.9155"
                        fill="none"
                        stroke={segment.color}
                        strokeWidth="4"
                        pathLength={100}
                        strokeDasharray={`${pct} ${100 - pct}`}
                        strokeDashoffset={-offset}
                        transform="rotate(-90 18 18)"
                    />
                );
                offset += pct;
                return arc;
            })}
        </svg>
    );
}

function ChecksTabIcon({ checks }: { checks: CheckRun[] }) {
    let icon: React.ReactNode;
    if (!checks.length) {
        icon = <Circle className="size-3.5 text-text-muted" />;
    } else if (checks.some((c) => c.status === "in_progress")) {
        icon = <StatusCheckIcon state="IN_PROGRESS" className="size-3.5" />;
    } else if (checks.some((c) => c.status !== "completed")) {
        icon = <StatusCheckIcon state="QUEUED" className="size-3.5" />;
    } else if (checks.every((c) => c.conclusion === "success")) {
        icon = <Check className="size-3.5 text-green-600" />;
    } else {
        icon = <ChecksRing checks={checks} className="size-3.5" />;
    }

    const breakdown = checkBreakdown(checks);
    if (!breakdown.length) {
        return icon;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="flex items-center">{icon}</span>
            </TooltipTrigger>
            <TooltipContent side="top">
                <div className="flex flex-col gap-1">
                    {breakdown.map((entry) => (
                        <div
                            key={entry.label}
                            className="flex items-center gap-1.5"
                        >
                            <span
                                className="size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: entry.color }}
                            />
                            <span>
                                {entry.count} {entry.label}
                            </span>
                        </div>
                    ))}
                </div>
            </TooltipContent>
        </Tooltip>
    );
}

export default function RightSidebar({
    pullRequestPromise,
    checksPromise,
    permissionContextPromise,
    owner,
    repo,
    number,
}: RightSidebarProps) {
    const [tab, setTab] = useState<"checks" | "commits">(
        checksPromise ? "checks" : "commits",
    );

    const scrollRef = useRef<HTMLDivElement>(null);

    const pullRequest = pullRequestPromise ? use(pullRequestPromise) : null;
    const initialChecks = checksPromise ? use(checksPromise) : null;

    const commitCount = pullRequest?.commits ?? 0;
    const isMerged = pullRequest?.merged ?? false;
    const isClosed = pullRequest?.state === "closed";
    const createdAt = pullRequest?.created_at ?? null;
    const sha = pullRequest?.head?.sha;

    const { data: checks } = api.checks.list.useQuery(
        { owner, repo, sha: sha as string },
        {
            enabled: !!sha && !!checksPromise,
            initialData: initialChecks ?? undefined,
            refetchInterval(query) {
                const data = query.state.data as Array<CheckRun> | undefined;
                if (!data) return false;

                return computeChecksPollingInterval(data, {
                    isMerged,
                    isClosed,
                    createdAt,
                });
            },
        },
    );

    const displayChecks = checks ?? initialChecks;
    const checkCount = displayChecks?.length ?? 0;

    if (!pullRequestPromise) {
        return (
            <aside
                className="border-border-subtle border-l bg-surface px-4 py-6"
                data-testid="right-sidebar"
            >
                <p className="text-sm text-text-tertiary">
                    No pull request data available.
                </p>
            </aside>
        );
    }

    const tabs: {
        key: "checks" | "commits";
        icon: React.ReactNode;
        label: string;
    }[] = [
        ...(checksPromise
            ? [
                  {
                      key: "checks" as const,
                      icon: <ChecksTabIcon checks={displayChecks ?? []} />,
                      label: `Checks (${checkCount})`,
                  },
              ]
            : []),
        {
            key: "commits" as const,
            icon: null,
            label: `Commits (${commitCount})`,
        },
    ];

    return (
        <aside
            className="flex h-full flex-col border-border-subtle border-l bg-surface px-4 py-6"
            data-testid="right-sidebar"
        >
            <div className="sticky top-0 z-10 space-y-4 bg-surface pb-4">
                <MetadataSection
                    permissionContextPromise={permissionContextPromise}
                    pullRequestPromise={pullRequestPromise}
                    owner={owner}
                    repo={repo}
                    number={number}
                />
                <div className="mt-10 flex gap-1 border-border-subtle border-b pb-2">
                    {tabs.map(({ key, icon, label }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTab(key)}
                            className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 font-medium text-sm transition-colors ${
                                tab === key
                                    ? "bg-surface-tertiary text-text-primary"
                                    : "text-text-secondary hover:bg-surface-tertiary hover:text-text-primary dark:hover:text-zinc-100"
                            }`}
                        >
                            {icon}
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
                {tab === "checks" && checksPromise ? (
                    <ChecksSection checks={displayChecks ?? []} />
                ) : null}
                {tab === "commits" ? (
                    <CommitsSection
                        pullRequestPromise={pullRequestPromise}
                        scrollRef={scrollRef}
                        owner={owner}
                        repo={repo}
                        number={number}
                    />
                ) : null}
            </div>
        </aside>
    );
}
