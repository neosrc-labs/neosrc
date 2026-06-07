"use client";

import { MessageSquare, MessageSquareOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Async } from "~/components/async";
import FileDiff from "~/components/FileDiff";
import {
    LazyRenderItem,
    SCROLL_TARGET_EVENT,
} from "~/components/LazyRenderItem";
import { useFiles } from "~/hooks/files";
import type { PullsGetResponseData, ReviewComment } from "~/server/github";
import { api } from "~/trpc/react";
import { getStoredSet, getViewedKey } from "~/utils/viewed-files";

function FileDiffSkeleton() {
    return (
        <div className="mb-6 overflow-hidden rounded border border-gray-200 dark:border-zinc-700">
            <div className="flex items-center gap-2 border-gray-200 border-b bg-gray-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
                <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
            </div>
            <div className="bg-white p-5 dark:bg-zinc-950">
                <div className="space-y-2">
                    <div className="h-4 w-5/6 animate-pulse rounded bg-gray-100 dark:bg-zinc-800" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-zinc-800" />
                    <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100 dark:bg-zinc-800" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-zinc-800" />
                    <div className="h-4 w-2/5 animate-pulse rounded bg-gray-100 dark:bg-zinc-800" />
                    <div className="h-4 w-4/5 animate-pulse rounded bg-gray-100 dark:bg-zinc-800" />
                    <div className="h-4 w-3/5 animate-pulse rounded bg-gray-100 dark:bg-zinc-800" />
                    <div className="h-4 w-1/3 animate-pulse rounded bg-gray-100 dark:bg-zinc-800" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-zinc-800" />
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
}

export function FilesSection({
    owner,
    repo,
    number,
    commitSha,
    pullRequestPromise,
}: FilesSectionProps) {
    const [showComments, setShowComments] = useState(true);
    const [expandedGeneratedFiles, setExpandedGeneratedFiles] = useState(
        () => new Set<string>(),
    );
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

    const toggleGeneratedFile = useCallback((filename: string) => {
        setExpandedGeneratedFiles((prev) => {
            const next = new Set(prev);
            if (next.has(filename)) {
                next.delete(filename);
            } else {
                next.add(filename);
            }
            return next;
        });
    }, []);

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
            window.dispatchEvent(
                new CustomEvent(SCROLL_TARGET_EVENT, { detail: id }),
            );
            const el = document.getElementById(id);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }, [allCommentsAll]);

    useEffect(() => {
        if (isLoading || allFiles.length === 0) return;
        const hash = window.location.hash;
        if (!hash || hash.startsWith("#review-thread-")) return;

        const id = hash.slice(1);

        window.dispatchEvent(
            new CustomEvent(SCROLL_TARGET_EVENT, { detail: id }),
        );

        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }

        const observer = new MutationObserver(() => {
            const el = document.getElementById(id);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 15000);
    }, [allFiles, isLoading]);

    return (
        <div>
            <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 text-lg dark:text-gray-100">
                    Files Changed{!isLoading && ` (${allFiles.length})`}
                </h2>
                <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5 text-gray-600 text-xs dark:text-gray-400">
                        <div className="flex items-center gap-1.5">
                            <span>
                                {viewedCount}/{allFiles.length} files viewed
                            </span>
                        </div>
                        <div className="h-1 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-700">
                            <div
                                className="h-full rounded-full bg-blue-400 transition-all"
                                style={{
                                    width: `${allFiles.length > 0
                                            ? (viewedCount / allFiles.length) *
                                            100
                                            : 0
                                        }%`,
                                }}
                            />
                        </div>
                    </div>
                    <button
                        className="cursor-pointer rounded-md bg-white px-3 py-1.5 font-medium text-gray-700 text-sm ring-1 ring-gray-300 transition-colors hover:bg-gray-50 dark:bg-zinc-800 dark:text-gray-300 dark:ring-zinc-600 dark:hover:bg-zinc-700"
                        onClick={() => setShowComments(!showComments)}
                        title={showComments ? "Hide comments" : "Show comments"}
                        type="button"
                    >
                        {showComments ? (
                            <MessageSquare size={16} />
                        ) : (
                            <MessageSquareOff size={16} />
                        )}
                    </button>
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
                            const fileId = file.filename.replace(/\//g, "-");
                            const totalChanged =
                                file.additions + file.deletions;
                            const isOverflow =
                                index >= OVERFLOW_THRESHOLD ||
                                file.status === "removed" ||
                                totalChanged > 1000;

                            return (
                                <LazyRenderItem
                                    className="scroll-mt-[calc(var(--header-height)+8px)]"
                                    heightMap={heightMapRef.current}
                                    id={fileId}
                                    itemKey={file.filename}
                                    key={file.filename}
                                    renderOnIds={[
                                        ...fileComments.map(
                                            (c) => `review-thread-${c.id}`,
                                        ),
                                        fileId,
                                    ]}
                                >
                                    <FileDiff
                                        baseSha={pullRequest.base.sha}
                                        headSha={
                                            pullRequest.head.sha ?? commitSha
                                        }
                                        comments={fileComments}
                                        file={file}
                                        number={number.toString()}
                                        onToggleGeneratedDiff={() =>
                                            toggleGeneratedFile(file.filename)
                                        }
                                        onTogglePerformanceDiff={() =>
                                            toggleOverflowFile(file.filename)
                                        }
                                        owner={owner}
                                        pendingReviewId={pendingReviewId}
                                        performanceHidden={isOverflow}
                                        repo={repo}
                                        showComments={showComments}
                                        showGeneratedDiff={
                                            expandedGeneratedFiles.has(
                                                file.filename,
                                            ) ||
                                            (isOverflow &&
                                                expandedOverflowFiles.has(
                                                    file.filename,
                                                ))
                                        }
                                        showPerformanceDiff={expandedOverflowFiles.has(
                                            file.filename,
                                        )}
                                    />
                                </LazyRenderItem>
                            );
                        })}
                    </div>
                )}
            </Async>
        </div>
    );
}
