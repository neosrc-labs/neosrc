"use client";

import { Check, Circle, CircleSlash, XCircle } from "lucide-react";
import Image from "next/image";
import { use, useRef, useState } from "react";
import { CheckHoverCard } from "~/components/hovercards/check-hover-card";
import { GitHubIcon } from "~/components/icons";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "~/components/ui/tooltip";
import type { CheckRun, PullsGetResponseData } from "~/server/github";
import { api } from "~/trpc/react";
import { computeChecksPollingInterval } from "~/utils/checks-polling";
import type { PullRequestPermissionContext } from "../permissions-utils";
import { CommitsSection } from "./commits-section";
import { MetadataSection } from "./metadata-section";

interface RightSidebarProps {
    pullRequestPromise: Promise<PullsGetResponseData> | null;
    checksPromise: Promise<Array<CheckRun>> | null;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
    owner: string;
    repo: string;
    number: number;
}

// Ordered categories for the checks breakdown. Each check is assigned to the
// first matching category; anything unmatched falls through to "other". The
// colors mirror the Tailwind palette used elsewhere for check states and drive
// both the progress-ring arcs and the tooltip legend dots.
const CHECK_CATEGORIES: {
    label: string;
    color: string;
    match: (check: CheckRun) => boolean;
}[] = [
    {
        label: "pending",
        color: "#eab308",
        match: (c) => c.status !== "completed",
    },
    {
        label: "passed",
        color: "#16a34a",
        match: (c) => c.conclusion === "success",
    },
    {
        label: "failed",
        color: "#dc2626",
        match: (c) =>
            c.conclusion === "failure" ||
            c.conclusion === "error" ||
            c.conclusion === "timed_out",
    },
    {
        label: "action required",
        color: "#ca8a04",
        match: (c) => c.conclusion === "action_required",
    },
    {
        label: "skipped",
        color: "#9ca3af",
        match: (c) => c.conclusion === "skipped",
    },
    {
        label: "cancelled",
        color: "#9ca3af",
        match: (c) => c.conclusion === "cancelled",
    },
    {
        label: "neutral",
        color: "#6b7280",
        match: (c) => c.conclusion === "neutral",
    },
];

const OTHER_CATEGORY_COLOR = "#6b7280";

function checkBreakdown(
    checks: CheckRun[],
): { label: string; color: string; count: number }[] {
    const counts = CHECK_CATEGORIES.map((cat) => ({ ...cat, count: 0 }));
    let other = 0;
    for (const check of checks) {
        const bucket = counts.find((cat) => cat.match(check));
        if (bucket) {
            bucket.count++;
        } else {
            other++;
        }
    }
    const result = counts
        .filter((entry) => entry.count > 0)
        .map((entry) => ({
            label: entry.label,
            color: entry.color,
            count: entry.count,
        }));
    if (other > 0) {
        result.push({
            label: "other",
            color: OTHER_CATEGORY_COLOR,
            count: other,
        });
    }
    return result;
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
    } else if (checks.some((c) => c.status !== "completed")) {
        icon = (
            <span className="check-pending-dot size-2.5 shrink-0 rounded-full" />
        );
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

interface ChecksSectionProps {
    checks: Array<CheckRun>;
}

function ChecksSection({ checks }: ChecksSectionProps) {
    if (!checks || checks.length === 0) {
        return <p className="text-sm text-text-tertiary">No checks</p>;
    }

    return (
        <div className="space-y-2">
            {checks.map((check: CheckRun) => (
                <CheckHoverCard
                    check={check}
                    key={check.html_url ?? check.name}
                >
                    <a
                        className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-surface-tertiary"
                        href={check.html_url}
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        <span className="flex shrink-0 items-center gap-2">
                            {check.conclusion === "success" ? (
                                <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : check.conclusion === "failure" ? (
                                <XCircle className="h-3.5 w-3.5 text-red-600" />
                            ) : check.conclusion === "skipped" ? (
                                <CircleSlash className="h-3.5 w-3.5 text-text-muted" />
                            ) : check.status === "in_progress" ? (
                                <span className="check-pending-dot size-2.5 shrink-0 rounded-full" />
                            ) : (
                                <Circle className="h-3.5 w-3.5 text-text-muted" />
                            )}
                            {check.app?.name === "GitHub Actions" ? (
                                <GitHubIcon className="size-5 text-text-primary" />
                            ) : check.creator?.avatar_url ? (
                                <Image
                                    src={check.creator.avatar_url}
                                    alt=""
                                    className="h-5 w-5 rounded-full"
                                    width={20}
                                    height={20}
                                />
                            ) : check.app?.owner?.avatar_url ? (
                                <Image
                                    src={check.app.owner.avatar_url}
                                    alt=""
                                    className="h-5 w-5 rounded-full"
                                    width={20}
                                    height={20}
                                />
                            ) : null}
                        </span>
                        <span className="min-w-0 truncate text-sm text-text-label">
                            {check.name}
                            {check.description && (
                                <span className="text-text-tertiary">
                                    {" "}
                                    - {check.description}
                                </span>
                            )}
                        </span>
                    </a>
                </CheckHoverCard>
            ))}
        </div>
    );
}
