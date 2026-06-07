"use client";

import { GitMerge, GitPullRequest, GitPullRequestClosed } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { PullRequestRow } from "./pull-request-row";

type FilterState = "open" | "closed" | "merged";

const TABS: { key: FilterState; label: string }[] = [
    { key: "open", label: "Open" },
    { key: "closed", label: "Closed" },
    { key: "merged", label: "Merged" },
];

export function PullRequestList({
    owner,
    repo,
    defaultState,
}: {
    owner: string;
    repo: string;
    defaultState: FilterState;
}) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const activeTab: FilterState =
        (searchParams.get("state") as FilterState) ?? defaultState;

    const apiState = activeTab === "merged" ? "all" : activeTab;
    const { data, isLoading } = api.pulls.list.useQuery({
        owner,
        repo,
        state: apiState,
    });

    const filteredPulls = useMemo(() => {
        if (!data?.pulls) return [];
        if (activeTab === "merged") {
            return data.pulls.filter((pr) => pr.merged_at != null);
        }
        if (activeTab === "closed") {
            return data.pulls;
        }
        return data.pulls;
    }, [data, activeTab]);

    const setTab = useCallback(
        (tab: FilterState) => {
            const params = new URLSearchParams(searchParams.toString());
            if (tab === "open") {
                params.delete("state");
            } else {
                params.set("state", tab);
            }
            router.replace(`/${owner}/${repo}/pulls?${params.toString()}`);
        },
        [owner, repo, router, searchParams],
    );

    return (
        <div>
            <div className="border-gray-200 border-b dark:border-zinc-800">
                <div className="flex">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setTab(tab.key)}
                            className={cn(
                                "relative -mb-px px-4 py-3 font-medium text-sm transition-colors",
                                activeTab === tab.key
                                    ? "border-blue-500 border-b-2 text-gray-900 dark:text-gray-100"
                                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100",
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                {isLoading ? (
                    <div className="space-y-0">
                        {["sk1", "sk2", "sk3", "sk4", "sk5"].map((id) => (
                            <div
                                key={id}
                                className="flex items-center gap-3 border-gray-200 border-b px-4 py-3 dark:border-zinc-800"
                            >
                                <div className="size-4 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                                    <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredPulls.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                        {activeTab === "open" && (
                            <>
                                <GitPullRequest className="size-8 text-gray-400" />
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                    No open pull requests
                                </p>
                            </>
                        )}
                        {activeTab === "closed" && (
                            <>
                                <GitPullRequestClosed className="size-8 text-gray-400" />
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                    No closed pull requests
                                </p>
                            </>
                        )}
                        {activeTab === "merged" && (
                            <>
                                <GitMerge className="size-8 text-gray-400" />
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                    No merged pull requests
                                </p>
                            </>
                        )}
                    </div>
                ) : (
                    <div>
                        {filteredPulls.map((pr) => (
                            <PullRequestRow
                                key={pr.id}
                                pr={pr}
                                owner={owner}
                                repo={repo}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
