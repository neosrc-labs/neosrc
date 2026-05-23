"use client";

import { use, useState } from "react";
import { CheckHoverCard } from "~/components/check-hover-card";
import type {
    CheckRun,
    PullsGetResponseData,
    PullsListCommitsResponseData,
} from "~/server/github";
import { CommitsSection } from "./commits-section";
import { MetadataSection } from "./metadata-section";

interface RightSidebarProps {
    pullRequestPromise: Promise<PullsGetResponseData> | null;
    commitsPromise: Promise<PullsListCommitsResponseData> | null;
    checksPromise: Promise<Array<CheckRun>> | null;
    owner: string;
    repo: string;
    number: number;
}

export default function RightSidebar({
    pullRequestPromise,
    commitsPromise,
    checksPromise,
    owner,
    repo,
    number,
}: RightSidebarProps) {
    const [tab, setTab] = useState<"checks" | "commits">("checks");

    if (!pullRequestPromise) {
        return (
            <aside className="border-gray-200 border-l bg-white px-4 py-6 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-gray-500 text-sm dark:text-gray-400">
                    No pull request data available.
                </p>
            </aside>
        );
    }

    const tabs = [
        ...(checksPromise ? [["checks", "Checks"] as const] : []),
        ["commits", "Commits"] as const,
    ];

    return (
        <aside className="flex h-full flex-col border-gray-200 border-l bg-white px-4 py-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="sticky top-0 z-10 space-y-4 bg-white pb-4 dark:bg-zinc-950">
                <MetadataSection
                    pullRequestPromise={pullRequestPromise}
                    owner={owner}
                    repo={repo}
                    number={number}
                />
                <div className="flex gap-1 border-gray-200 border-b pb-2 dark:border-zinc-800">
                    {tabs.map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTab(key)}
                            className={`rounded-md px-2.5 py-1 font-medium text-sm transition-colors ${
                                tab === key
                                    ? "bg-gray-100 text-gray-900 dark:bg-zinc-800 dark:text-zinc-100"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pt-4">
                {tab === "checks" && checksPromise ? (
                    <ChecksSection checksPromise={checksPromise} />
                ) : null}
                {tab === "commits" ? (
                    <CommitsSection
                        commitsPromise={commitsPromise}
                        pullRequestPromise={pullRequestPromise}
                    />
                ) : null}
            </div>
        </aside>
    );
}

interface ChecksSectionProps {
    checksPromise: Promise<Array<CheckRun>>;
}

function ChecksSection({ checksPromise }: ChecksSectionProps) {
    const checks = use(checksPromise);

    if (!checks || checks.length === 0) {
        return (
            <p className="text-gray-500 text-sm dark:text-zinc-400">
                No checks
            </p>
        );
    }

    return (
        <div className="space-y-2">
            {checks.map((check) => (
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
                        <span className="text-sm">
                            {check.conclusion === "success" ? (
                                <span className="text-green-600">✓</span>
                            ) : check.conclusion === "failure" ? (
                                <span className="text-red-600">✗</span>
                            ) : check.status === "in_progress" ? (
                                <span className="text-gray-400">⏳</span>
                            ) : (
                                <span className="text-gray-400">○</span>
                            )}
                        </span>
                        <span className="truncate text-gray-700 text-sm dark:text-zinc-300">
                            {check.name}
                        </span>
                    </a>
                </CheckHoverCard>
            ))}
        </div>
    );
}
