"use client";

import { GitMerge, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RepositoryInfo } from "~/server/api/routers/repos";
import type { MergeMethod, PullsGetResponseData } from "~/server/github";
import { api } from "~/trpc/react";

interface AutoMergeToggleProps {
    owner: string;
    repo: string;
    number: number;
    pullRequest: PullsGetResponseData;
    repoData?: RepositoryInfo;
    availableMergeOptions: {
        value: MergeMethod;
        label: string;
        allowed: boolean;
    }[];
    mergeMode: MergeMethod;
    onMergeModeChange: (mode: MergeMethod) => void;
    canMerge: boolean;
}

function MergeMethodLabel(method: string) {
    switch (method) {
        case "squash":
            return "squash";
        case "rebase":
            return "rebase";
        default:
            return "merge";
    }
}

export function AutoMergeToggle({
    owner,
    repo,
    number,
    pullRequest,
    repoData,
    availableMergeOptions,
    mergeMode,
    onMergeModeChange,
    canMerge,
}: AutoMergeToggleProps) {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const enableMutation = api.pulls.enableAutoMerge.useMutation({
        onSuccess: () => {
            setError(null);
            router.refresh();
        },
        onError: (err) => setError(err.message),
    });

    const disableMutation = api.pulls.disableAutoMerge.useMutation({
        onSuccess: () => {
            setError(null);
            router.refresh();
        },
        onError: (err) => setError(err.message),
    });

    type AutoMergeData = {
        enabled_by: { login: string; avatar_url?: string } | null;
        merge_method: string;
        commit_title?: string;
        commit_message?: string;
    } | null;

    const getAutoMerge = (pr: PullsGetResponseData): AutoMergeData => {
        if ("auto_merge" in pr) {
            const val = (pr as PullsGetResponseData & { auto_merge: unknown })
                .auto_merge;
            if (val && typeof val === "object" && "merge_method" in val) {
                const candidate = val as Record<string, unknown>;
                const mergeMethod = candidate["merge_method"];
                const enabledBy = candidate["enabled_by"];
                if (typeof mergeMethod === "string") {
                    return {
                        enabled_by:
                            enabledBy &&
                            typeof enabledBy === "object" &&
                            "login" in enabledBy
                                ? {
                                      login: String(
                                          (
                                              enabledBy as Record<
                                                  string,
                                                  unknown
                                              >
                                          )["login"] ?? "",
                                      ),
                                  }
                                : null,
                        merge_method: mergeMethod,
                    };
                }
            }
            return null;
        }
        return null;
    };

    const rawAutoMerge = getAutoMerge(pullRequest);

    const allowAutoMerge = repoData?.allowAutoMerge;
    // Hide when repo explicitly disables auto-merge
    if (allowAutoMerge === false) return null;
    // Need write permission to toggle auto-merge
    if (!canMerge) return null;
    // Draft or closed PRs cannot use auto-merge
    if (pullRequest.draft || pullRequest.state !== "open") return null;
    if (pullRequest.merged) return null;
    if (availableMergeOptions.length === 0) return null;

    const effectiveMergeMode = availableMergeOptions.some(
        (o) => o.value === mergeMode,
    )
        ? mergeMode
        : (availableMergeOptions[0]?.value ?? "merge");

    // Enabled state
    if (rawAutoMerge) {
        const actor = rawAutoMerge.enabled_by?.login ?? "unknown";
        const method = MergeMethodLabel(rawAutoMerge.merge_method);
        return (
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-md border border-green-300 bg-green-50 px-3 py-1.5 text-green-800 text-xs dark:border-green-700 dark:bg-green-950 dark:text-green-200">
                    <GitMerge
                        size={14}
                        className="text-green-600 dark:text-green-400"
                    />
                    <span>
                        Auto-merge enabled by{" "}
                        <span className="font-semibold">@{actor}</span> (
                        {method})
                    </span>
                    <button
                        type="button"
                        disabled={disableMutation.isPending}
                        onClick={() =>
                            disableMutation.mutate({ owner, repo, number })
                        }
                        className="ml-2 inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 font-medium text-xs text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    >
                        <X size={12} />
                        {disableMutation.isPending ? "Disabling..." : "Disable"}
                    </button>
                </div>
                {error && <span className="text-red-600 text-xs">{error}</span>}
                {disableMutation.isError && !error && (
                    <span className="text-red-600 text-xs">
                        Failed to disable. Please try again.
                    </span>
                )}
            </div>
        );
    }

    // Not enabled — show enable affordance
    return (
        <div className="flex items-stretch">
            {error && (
                <span className="mr-2 self-center text-red-600 text-xs">
                    {error}
                </span>
            )}
            {enableMutation.isError && !error && (
                <span className="mr-2 self-center text-red-600 text-xs">
                    Failed to enable. Please try again.
                </span>
            )}
            <button
                className="flex cursor-pointer items-center gap-1.5 text-nowrap rounded-l-md bg-[#2da44e] px-1.5 py-2 font-medium text-white text-xs transition-colors hover:bg-[#218838] disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
                disabled={enableMutation.isPending}
                onClick={() =>
                    enableMutation.mutate({
                        owner,
                        repo,
                        number,
                        mergeMethod: effectiveMergeMode,
                    })
                }
                title={`Enable auto-merge (${effectiveMergeMode})`}
                type="button"
            >
                <GitMerge size={14} />
                {enableMutation.isPending ? "Enabling..." : "Enable auto-merge"}
            </button>
            <div className="relative flex">
                <select
                    value={effectiveMergeMode}
                    onChange={(e) =>
                        onMergeModeChange(e.target.value as MergeMethod)
                    }
                    disabled={enableMutation.isPending}
                    className="flex cursor-pointer appearance-none items-center rounded-r-md border-[#1a7f37] border-l bg-[#2da44e] px-2 pr-6 text-white text-xs transition-colors hover:bg-[#218838] disabled:cursor-not-allowed disabled:opacity-50"
                    title="Auto-merge method"
                    aria-label="Auto-merge method"
                >
                    {availableMergeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-white">
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        aria-hidden="true"
                    >
                        <path d="M4.427 5.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 5H4.604a.25.25 0 00-.177.427z" />
                    </svg>
                </span>
            </div>
        </div>
    );
}
