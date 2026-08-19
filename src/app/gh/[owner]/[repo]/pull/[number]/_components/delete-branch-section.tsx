"use client";

import { GitMerge, GitPullRequestClosed } from "lucide-react";
import { useState } from "react";
import { TIMELINE_PAGE_SIZE } from "~/lib/timeline-constants";
import { api } from "~/trpc/react";

const branchLinkClassName =
    "rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-800 hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/30";

export function DeleteBranchSection({
    branchHref,
    branchLabel,
    canDelete,
    merged,
    number,
    owner,
    repo,
}: {
    branchHref: string;
    branchLabel: string;
    canDelete: boolean;
    merged: boolean;
    number: number;
    owner: string;
    repo: string;
}) {
    const utils = api.useUtils();
    const [deleted, setDeleted] = useState(false);
    const deleteBranch = api.pulls.deleteBranch.useMutation({
        onSuccess: () => {
            utils.timeline.list.invalidate({
                owner,
                repo,
                number,
                limit: TIMELINE_PAGE_SIZE,
            });
            setDeleted(true);
        },
    });

    if (deleted) return null;

    const message = merged
        ? "Pull request successfully merged and closed"
        : "Closed with unmerged commits";

    return (
        <div className="mb-4 rounded-lg border border-border bg-surface-secondary px-4 py-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    {merged ? (
                        <GitMerge
                            className="shrink-0 text-state-merged"
                            size={16}
                        />
                    ) : (
                        <GitPullRequestClosed
                            className="shrink-0 text-state-closed"
                            size={16}
                        />
                    )}
                    <span className="truncate text-sm text-text-primary">
                        {message}
                    </span>
                    <a href={branchHref} className={branchLinkClassName}>
                        <span className="select-all" title={branchLabel}>
                            {branchLabel}
                        </span>
                    </a>
                </div>
                {canDelete && (
                    <button
                        type="button"
                        className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md bg-surface-elevated px-4 py-1.5 font-medium text-sm text-text-label ring-1 ring-ring transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-700"
                        disabled={deleteBranch.isPending}
                        onClick={() =>
                            deleteBranch.mutate({ owner, repo, number })
                        }
                    >
                        {deleteBranch.isPending
                            ? "Deleting..."
                            : "Delete branch"}
                    </button>
                )}
            </div>
            {deleteBranch.isError && (
                <p className="mt-1 text-destructive text-xs">
                    Failed to delete branch. Please try again.
                </p>
            )}
        </div>
    );
}
