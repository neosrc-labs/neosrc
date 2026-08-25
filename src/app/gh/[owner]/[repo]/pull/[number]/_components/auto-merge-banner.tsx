"use client";

import { GitMerge } from "lucide-react";
import type { PullsGetResponseData } from "~/server/github";

function mergeMethodLabel(method: string) {
    switch (method) {
        case "squash":
            return "squash";
        case "rebase":
            return "rebase";
        default:
            return "merge";
    }
}

type AutoMergeData = {
    enabled_by: { login: string } | null;
    merge_method: string;
} | null;

function getAutoMerge(pr: PullsGetResponseData): AutoMergeData {
    if (!("auto_merge" in pr)) return null;
    const val = (pr as PullsGetResponseData & { auto_merge: unknown })
        .auto_merge;
    if (
        val &&
        typeof val === "object" &&
        "merge_method" in (val as Record<string, unknown>)
    ) {
        const candidate = val as Record<string, unknown>;
        const mergeMethod = candidate["merge_method"];
        const enabledBy = candidate["enabled_by"];
        if (typeof mergeMethod === "string") {
            return {
                enabled_by:
                    enabledBy &&
                    typeof enabledBy === "object" &&
                    "login" in (enabledBy as Record<string, unknown>)
                        ? {
                              login: String(
                                  (enabledBy as Record<string, unknown>)[
                                      "login"
                                  ] ?? "",
                              ),
                          }
                        : null,
                merge_method: mergeMethod,
            };
        }
    }
    return null;
}

interface AutoMergeBannerProps {
    pullRequest: PullsGetResponseData;
}

export function AutoMergeBanner({ pullRequest }: AutoMergeBannerProps) {
    const rawAutoMerge = getAutoMerge(pullRequest);

    if (!rawAutoMerge) return null;
    const actor = rawAutoMerge.enabled_by?.login ?? "unknown";
    const method = mergeMethodLabel(rawAutoMerge.merge_method);

    return (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-secondary px-4 py-2">
            <GitMerge className="size-4 shrink-0 text-green-600 dark:text-green-400" />
            <p className="truncate font-medium text-sm text-text-label">
                Auto-merge enabled by{" "}
                <span className="font-semibold">@{actor}</span> ({method})
            </p>
        </div>
    );
}
