"use client";

import { GitForkIcon, RefreshCwIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "~/trpc/react";

interface ForkSyncRowProps {
    owner: string;
    repo: string;
    parentFullName: string;
    defaultBranch: string;
    parentDefaultBranch: string;
}

export function ForkSyncRow({
    owner,
    repo,
    parentFullName,
    defaultBranch,
    parentDefaultBranch,
}: ForkSyncRowProps) {
    const [confirming, setConfirming] = useState(false);

    const utils = api.useUtils();

    const { data: comparison, isFetching: comparisonFetching } =
        api.repos.getForkComparison.useQuery({
            owner,
            repo,
            upstreamFullName: parentFullName,
            forkBranch: defaultBranch,
            parentBranch: parentDefaultBranch,
        });

    const syncMutation = api.repos.mergeUpstream.useMutation({
        onSuccess: () => {
            setConfirming(false);
            utils.repos.getForkComparison.invalidate({
                owner,
                repo,
                upstreamFullName: parentFullName,
                forkBranch: defaultBranch,
                parentBranch: parentDefaultBranch,
            });
        },
    });

    const [parentOwner, parentRepo] = parentFullName.split("/");

    const compareUrl = useMemo(() => {
        if (!parentOwner || !parentRepo) return null;
        const forkRef = encodeURIComponent(defaultBranch);
        const upstreamRef = encodeURIComponent(
            `${parentOwner}:${parentRepo}:${parentDefaultBranch}`,
        );
        return `https://github.com/${owner}/${repo}/compare/${forkRef}...${upstreamRef}`;
    }, [parentOwner, parentRepo, parentDefaultBranch, owner, repo, defaultBranch]);

    if (comparisonFetching || !comparison) {
        return (
            <div className="flex items-center gap-3 border-border border-b px-4 py-2.5">
                <div className="h-3 w-64 animate-pulse rounded bg-surface-secondary" />
            </div>
        );
    }

    const { aheadBy, behindBy } = comparison;
    const hasDivergence = aheadBy > 0 || behindBy > 0;

    return (
        <div className="flex items-center gap-3 border-border border-b px-4 py-2.5">
            <GitForkIcon className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
            <span className="text-text-tertiary text-xs">
                {behindBy > 0 && aheadBy > 0 ? (
                    <>
                        This branch is{" "}
                        {compareUrl ? (
                            <a
                                href={compareUrl}
                                className="font-semibold text-text-tertiary hover:text-blue-600 dark:hover:text-blue-400"
                            >
                                {behindBy.toLocaleString()} commits behind and{" "}
                                {aheadBy.toLocaleString()} commits ahead
                            </a>
                        ) : (
                            <strong>
                                {behindBy.toLocaleString()} commits behind and{" "}
                                {aheadBy.toLocaleString()} commits ahead
                            </strong>
                        )}{" "}
                        of{" "}
                        <a
                            href={`/gh/${parentFullName}`}
                            className="font-semibold text-text-tertiary hover:text-blue-600 dark:hover:text-blue-400"
                        >
                            {parentFullName}
                        </a>
                        .
                    </>
                ) : behindBy > 0 ? (
                    <>
                        This branch is{" "}
                        {compareUrl ? (
                            <a
                                href={compareUrl}
                                className="font-semibold text-text-tertiary hover:text-blue-600 dark:hover:text-blue-400"
                            >
                                {behindBy.toLocaleString()} commits behind
                            </a>
                        ) : (
                            <strong>
                                {behindBy.toLocaleString()} commits behind
                            </strong>
                        )}{" "}
                        <a
                            href={`/gh/${parentFullName}`}
                            className="font-semibold text-text-tertiary hover:text-blue-600 dark:hover:text-blue-400"
                        >
                            {parentFullName}
                        </a>
                        .
                    </>
                ) : aheadBy > 0 ? (
                    <>
                        This branch is{" "}
                        {compareUrl ? (
                            <a
                                href={compareUrl}
                                className="font-semibold text-text-tertiary hover:text-blue-600 dark:hover:text-blue-400"
                            >
                                {aheadBy.toLocaleString()} commits ahead
                            </a>
                        ) : (
                            <strong>
                                {aheadBy.toLocaleString()} commits ahead
                            </strong>
                        )}{" "}
                        of{" "}
                        <a
                            href={`/gh/${parentFullName}`}
                            className="font-semibold text-text-tertiary hover:text-blue-600 dark:hover:text-blue-400"
                        >
                            {parentFullName}
                        </a>
                        .
                    </>
                ) : (
                    <>
                        This branch is up to date with{" "}
                        <a
                            href={`/gh/${parentFullName}`}
                            className="font-semibold text-text-tertiary hover:text-blue-600 dark:hover:text-blue-400"
                        >
                            {parentFullName}
                        </a>
                        .
                    </>
                )}
            </span>
            {hasDivergence && behindBy > 0 && (
                <div className="ml-auto flex items-center gap-2">
                    {confirming ? (
                        <>
                            <span className="text-text-tertiary text-xs">
                                Sync changes from{" "}
                                {parentOwner ?? parentFullName}?
                            </span>
                            <button
                                type="button"
                                className="cursor-pointer rounded-md bg-blue-600 px-2.5 py-1 font-medium text-white text-xs hover:bg-blue-700"
                                onClick={() =>
                                    syncMutation.mutate({
                                        owner,
                                        repo,
                                        branch: defaultBranch,
                                    })
                                }
                                disabled={syncMutation.isPending}
                            >
                                {syncMutation.isPending ? "Syncing..." : "Sync"}
                            </button>
                            <button
                                type="button"
                                className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-text-secondary text-xs hover:bg-surface-secondary"
                                onClick={() => setConfirming(false)}
                                disabled={syncMutation.isPending}
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <>
                            {syncMutation.isError && (
                                <span className="text-red-600 text-xs">
                                    {syncMutation.error.message ??
                                        "Sync failed"}
                                </span>
                            )}
                            {syncMutation.isSuccess && (
                                <span className="text-green-600 text-xs">
                                    {syncMutation.data.message ??
                                        "Branch synced"}
                                </span>
                            )}
                            <button
                                type="button"
                                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2.5 py-1 text-text-secondary text-xs hover:bg-surface-secondary"
                                onClick={() => setConfirming(true)}
                            >
                                <RefreshCwIcon className="h-3 w-3" />
                                Sync fork
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
