"use client";

import { Check, Circle, CircleX, Loader2, X, XCircle } from "lucide-react";
import { use, useRef, useState } from "react";
import { CheckHoverCard } from "~/components/hovercards/check-hover-card";
import { UserLink } from "~/components/user-link";
import type { CheckRun, PullsGetResponseData } from "~/server/github";
import { api } from "~/trpc/react";
import {
    type CheckStatusRollup,
    computeCheckStatusRollup,
    computeChecksPollingInterval,
} from "~/utils/checks-polling";
import { CommitsSection } from "./commits-section";
import { MetadataSection } from "./metadata-section";

interface RightSidebarProps {
    pullRequestPromise: Promise<PullsGetResponseData> | null;
    checksPromise: Promise<Array<CheckRun>> | null;
    userPermission: Promise<string | null>;
    owner: string;
    repo: string;
    number: number;
}

function RollupIcon({ rollup }: { rollup: CheckStatusRollup | null }) {
    if (rollup === "SUCCESS") {
        return <Check className="size-3.5 text-green-600" />;
    }
    if (rollup === "FAILURE" || rollup === "ERROR" || rollup === "TIMED_OUT") {
        return <X className="size-3.5 text-red-600" />;
    }
    if (rollup === "CANCELLED") {
        return <CircleX className="size-3.5 text-gray-400" />;
    }
    if (rollup === "IN_PROGRESS" || rollup === "PENDING") {
        return <Loader2 className="size-3.5 animate-spin text-yellow-500" />;
    }
    return <Circle className="size-3.5 text-gray-400" />;
}

export default function RightSidebar({
    pullRequestPromise,
    checksPromise,
    userPermission,
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
    const createdAt = pullRequest?.created_at ?? "";
    const sha = pullRequest?.head?.sha;

    const { data: checks } = api.checks.list.useQuery(
        { owner, repo, sha: sha ?? "" },
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
    const rollup = computeCheckStatusRollup(displayChecks ?? []);

    if (!pullRequestPromise) {
        return (
            <aside className="border-gray-200 border-l bg-white px-4 py-6 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-gray-500 text-sm dark:text-gray-400">
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
                      icon: <RollupIcon rollup={rollup} />,
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
        <aside className="flex h-full flex-col border-gray-200 border-l bg-white px-4 py-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="sticky top-0 z-10 space-y-4 bg-white pb-4 dark:bg-zinc-950">
                <MetadataSection
                    userPermission={userPermission}
                    pullRequestPromise={pullRequestPromise}
                    owner={owner}
                    repo={repo}
                    number={number}
                />
                <div className="flex gap-1 border-gray-200 border-b pb-2 dark:border-zinc-800">
                    {tabs.map(({ key, icon, label }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTab(key)}
                            className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 font-medium text-sm transition-colors ${
                                tab === key
                                    ? "bg-gray-100 text-gray-900 dark:bg-zinc-800 dark:text-zinc-100"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
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
        return (
            <p className="text-gray-500 text-sm dark:text-zinc-400">
                No checks
            </p>
        );
    }

    return (
        <div className="space-y-2">
            {checks

                .map((a) => {
                    {
                        /* console.log(a) */
                    }
                    return a;
                })
                .map((check: CheckRun) => (
                    <CheckHoverCard
                        check={check}
                        key={check.html_url ?? check.name}
                    >
                        <a
                            className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800"
                            href={check.html_url}
                            rel="noopener noreferrer"
                            target="_blank"
                        >
                            <span className="flex shrink-0 items-center gap-1">
                                {check.conclusion === "success" ? (
                                    <Check className="h-3.5 w-3.5 text-green-600" />
                                ) : check.conclusion === "failure" ? (
                                    <XCircle className="h-3.5 w-3.5 text-red-600" />
                                ) : check.status === "in_progress" ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-500" />
                                ) : (
                                    <Circle className="h-3.5 w-3.5 text-gray-400" />
                                )}
                                {check.creator ? (
                                    <UserLink
                                        actor={{
                                            login: check.creator.login,
                                            avatarUrl: check.creator.avatar_url,
                                            url: check.creator.html_url,
                                        }}
                                        showUsername={false}
                                    />
                                ) : check.app?.owner?.avatar_url ? (
                                    <img
                                        src={check.app.owner.avatar_url}
                                        alt=""
                                        className="h-5 w-5 rounded-full"
                                    />
                                ) : null}
                            </span>
                            <span className="min-w-0 truncate text-gray-700 text-sm dark:text-zinc-300">
                                {check.name}
                                {check.description && (
                                    <span className="text-gray-500 dark:text-gray-400">
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
