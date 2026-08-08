"use client";

import { MessageSquare, MessageSquareOff, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Async } from "~/components/async";
import FileDiff from "~/components/file-diff";
import { useFiles } from "~/hooks/files";
import type {
    CheckRun,
    PullsGetResponseData,
    ReviewComment,
} from "~/server/github";
import { api } from "~/trpc/react";
import { EMPTY_ARRAY_PROMISE } from "~/utils/promise";
import { getStoredSet, getViewedKey } from "~/utils/viewed-files";
import { ActionSection } from "./action-section/actions-section";

function FileDiffSkeleton() {
    return (
        <div className="mb-6 overflow-hidden rounded border border-border">
            <div className="flex items-center gap-2 border-border border-b bg-surface-secondary px-4 py-3">
                <div className="h-4 w-1/3 animate-pulse rounded bg-surface-selected" />
            </div>
            <div className="bg-surface p-5">
                <div className="space-y-2">
                    <div className="h-4 w-5/6 animate-pulse rounded bg-surface-tertiary" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-surface-tertiary" />
                    <div className="h-4 w-3/4 animate-pulse rounded bg-surface-tertiary" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-surface-tertiary" />
                    <div className="h-4 w-2/5 animate-pulse rounded bg-surface-tertiary" />
                    <div className="h-4 w-4/5 animate-pulse rounded bg-surface-tertiary" />
                    <div className="h-4 w-3/5 animate-pulse rounded bg-surface-tertiary" />
                    <div className="h-4 w-1/3 animate-pulse rounded bg-surface-tertiary" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-surface-tertiary" />
                </div>
            </div>
        </div>
    );
}

interface FilesSectionProps {
    owner: string;
    repo: string;
    number: number;
    commitSha?: string;
    pullRequestPromise: Promise<PullsGetResponseData>;
    currentUserLogin?: string;
    userPermissionPromise?: Promise<string | null> | null;
    conflictedFilesPromise?: Promise<string[]> | null;
    checkRunsPromise?: Promise<CheckRun[]> | null;
}

export function FilesSection({
    owner,
    repo,
    number,
    commitSha,
    pullRequestPromise,
    currentUserLogin,
    userPermissionPromise,
    conflictedFilesPromise,
    checkRunsPromise,
}: FilesSectionProps) {
    const [showComments, setShowComments] = useState(true);
    const [expandedOverflowFiles, setExpandedOverflowFiles] = useState(
        () => new Set<string>(),
    );
    const heightMapRef = useRef(new Map<string, number>());
    const { files: allFiles, isLoading } = useFiles({
        owner,
        repo,
        number,
        commitSha,
    });

    // Poll the PR head so we can detect pushes made after the page rendered.
    const { data: currentHeadSha } = api.pulls.headSha.useQuery(
        { owner, repo, number },
        { refetchInterval: 15_000 },
    );

    const handleRefresh = useCallback(() => {
        window.location.href = `/gh/${owner}/${repo}/pull/${number}/changes`;
    }, [owner, repo, number]);

    const [viewedCount, setViewedCount] = useState(0);

    useEffect(() => {
        const key = getViewedKey(owner, repo, number);
        const viewed = getStoredSet(key);
        setViewedCount(allFiles.filter((f) => viewed.has(f.filename)).length);
    }, [allFiles, owner, repo, number]);

    useEffect(() => {
        const handler = () => {
            const key = getViewedKey(owner, repo, number);
            const viewed = getStoredSet(key);
            setViewedCount(
                allFiles.filter((f) => viewed.has(f.filename)).length,
            );
        };
        window.addEventListener("file-viewed-changed", handler);
        return () => window.removeEventListener("file-viewed-changed", handler);
    }, [allFiles, owner, repo, number]);

    const OVERFLOW_THRESHOLD = 200;

    const { data: allComments = [] } = api.reviewComments.list.useQuery(
        { owner, repo, number },
        { staleTime: 30_000 },
    );

    const { data: pendingReview } = api.reviews.getPending.useQuery(
        { owner, repo, number },
        { staleTime: 30_000 },
    );

    const allCommentsAll = useMemo((): ReviewComment[] => {
        const submitted = allComments;
        const pending = (pendingReview?.comments ?? []) as ReviewComment[];
        return [...submitted, ...pending];
    }, [allComments, pendingReview]);

    const pendingReviewId = pendingReview?.reviewId ?? null;

    const toggleOverflowFile = useCallback((filename: string) => {
        setExpandedOverflowFiles((prev) => {
            const next = new Set(prev);
            if (next.has(filename)) {
                next.delete(filename);
            } else {
                next.add(filename);
            }
            return next;
        });
    }, []);

    useEffect(() => {
        if (allFiles.length <= OVERFLOW_THRESHOLD) return;
        const firstOverflow = allFiles[OVERFLOW_THRESHOLD];
        if (!firstOverflow) return;
        const measuredHeight = heightMapRef.current.get(firstOverflow.filename);
        if (measuredHeight === undefined) return;
        for (let i = OVERFLOW_THRESHOLD; i < allFiles.length; i++) {
            const file = allFiles[i];
            if (!file) continue;
            const key = file.filename;
            if (!heightMapRef.current.has(key)) {
                heightMapRef.current.set(key, measuredHeight);
            }
        }
    }, [allFiles]);

    useEffect(() => {
        if (allCommentsAll.length === 0) return;
        const hash = window.location.hash;
        if (hash.startsWith("#review-thread-")) {
            const id = hash.slice(1);
            const el = document.getElementById(id);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }, [allCommentsAll]);

    return (
        <div>
            <div className="sticky top-0 z-10 flex items-center justify-between bg-surface py-4 pr-2">
                <div className="flex items-center gap-3">
                    <h2 className="text-text-primary">
                        Files Changed{!isLoading && ` (${allFiles.length})`}
                    </h2>
                    <Async promise={pullRequestPromise} fallback={null}>
                        {(pullRequest) => {
                            const displayedSha =
                                commitSha ?? pullRequest.head?.sha;
                            if (
                                !displayedSha ||
                                !currentHeadSha?.headSha ||
                                displayedSha === currentHeadSha.headSha
                            ) {
                                return null;
                            }
                            return (
                                <button
                                    type="button"
                                    className="flex cursor-pointer items-center gap-2 rounded-md bg-orange-600 px-3 py-1.5 font-medium text-sm text-white ring-1 ring-orange-700 transition-colors hover:bg-orange-700"
                                    onClick={handleRefresh}
                                    title="Refresh to view the latest changes"
                                >
                                    <RefreshCw size={14} />
                                    Refresh
                                </button>
                            );
                        }}
                    </Async>
                </div>
                <div className="flex items-center gap-3">
                    <Async promise={pullRequestPromise}>
                        {(pullRequest) => (
                            <div className="flex items-center gap-1.5 text-sm">
                                {pullRequest.additions > 0 && (
                                    <span className="font-medium text-green-600 dark:text-green-500">
                                        +
                                        {pullRequest.additions.toLocaleString()}
                                    </span>
                                )}
                                {pullRequest.deletions > 0 && (
                                    <span className="font-medium text-red-600 dark:text-red-500">
                                        -
                                        {pullRequest.deletions.toLocaleString()}
                                    </span>
                                )}
                            </div>
                        )}
                    </Async>
                    {allFiles.length > 0 && (
                        <div className="flex flex-col gap-0.5 text-text-secondary text-xs">
                            <div className="flex items-center gap-1.5">
                                <span>
                                    {viewedCount}/{allFiles.length} files viewed
                                </span>
                            </div>
                            <div className="h-1 w-24 overflow-hidden rounded-full bg-surface-selected">
                                <div
                                    className="h-full rounded-full bg-blue-400 transition-all"
                                    style={{
                                        width: `${
                                            allFiles.length > 0
                                                ? (
                                                      viewedCount /
                                                          allFiles.length
                                                  ) * 100
                                                : 0
                                        }%`,
                                    }}
                                />
                            </div>
                        </div>
                    )}
                    <button
                        className="flex cursor-pointer items-center gap-2 rounded-md bg-surface-elevated px-3 py-1.5 font-medium text-sm text-text-label ring-1 ring-ring transition-colors hover:bg-gray-50 dark:hover:bg-zinc-700"
                        onClick={() => setShowComments(!showComments)}
                        title={showComments ? "Hide comments" : "Show comments"}
                        type="button"
                    >
                        {showComments ? (
                            <MessageSquare size={16} />
                        ) : (
                            <MessageSquareOff size={16} />
                        )}
                        <span className="font-mono text-xs leading-none">
                            {allCommentsAll.length}
                        </span>
                    </button>
                    <Async
                        fallback={null}
                        promise={checkRunsPromise ?? EMPTY_ARRAY_PROMISE}
                    >
                        {(checkRuns) => (
                            <ActionSection
                                variant="inline"
                                owner={owner}
                                repo={repo}
                                number={number}
                                pullRequestPromise={pullRequestPromise}
                                conflictedFilesPromise={conflictedFilesPromise}
                                userPermissionPromise={userPermissionPromise}
                                currentUserLogin={currentUserLogin}
                                checkRuns={checkRuns}
                            />
                        )}
                    </Async>
                </div>
            </div>
            {isLoading && allFiles.length === 0 && (
                <>
                    <FileDiffSkeleton />
                    <FileDiffSkeleton />
                    <FileDiffSkeleton />
                </>
            )}
            <Async promise={pullRequestPromise}>
                {(pullRequest) => (
                    <div className="flex flex-col gap-6">
                        {allFiles.map((file, index) => {
                            const fileComments = allCommentsAll.filter(
                                (c) => c.path === file.filename,
                            );
                            const totalChanged =
                                file.additions + file.deletions;
                            const isOverflow =
                                index >= OVERFLOW_THRESHOLD ||
                                file.status === "removed" ||
                                totalChanged > 1000;

                            return (
                                <div
                                    key={file.filename}
                                    style={{ contentVisibility: "auto" }}
                                >
                                    <FileDiff
                                        baseSha={pullRequest.base.sha}
                                        headSha={
                                            pullRequest.head.sha ?? commitSha
                                        }
                                        comments={fileComments}
                                        file={file}
                                        number={number.toString()}
                                        onTogglePerformanceDiff={() =>
                                            toggleOverflowFile(file.filename)
                                        }
                                        owner={owner}
                                        pendingReviewId={pendingReviewId}
                                        performanceHidden={isOverflow}
                                        repo={repo}
                                        showComments={showComments}
                                        showPerformanceDiff={expandedOverflowFiles.has(
                                            file.filename,
                                        )}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </Async>
        </div>
    );
}
