"use client";

import { MessageSquare, MessageSquareOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FileDiff from "~/components/FileDiff";
import {
    LazyRenderItem,
    SCROLL_TARGET_EVENT,
} from "~/components/LazyRenderItem";
import { useFiles } from "~/hooks/files";
import type { ReviewComment } from "~/server/github";
import { api } from "~/trpc/react";

function FileDiffSkeleton() {
    return (
        <div className="mb-6 overflow-hidden rounded border border-gray-200 dark:border-zinc-700">
            <div className="flex items-center gap-2 border-gray-200 border-b bg-gray-50 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-900">
                <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
            </div>
            <div className="bg-white p-4 dark:bg-zinc-950">
                <div className="space-y-2">
                    <div className="h-3.5 w-5/6 animate-pulse rounded bg-gray-100 dark:bg-zinc-800" />
                    <div className="h-3.5 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-zinc-800" />
                    <div className="h-3.5 w-3/4 animate-pulse rounded bg-gray-100 dark:bg-zinc-800" />
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
    baseSha?: string;
    headSha?: string;
}

export function FilesSection({
    owner,
    repo,
    number,
    commitSha,
    baseSha,
    headSha,
}: FilesSectionProps) {
    const [showComments, setShowComments] = useState(true);
    const [expandedGeneratedFiles, setExpandedGeneratedFiles] = useState(
        () => new Set<string>(),
    );
    const heightMapRef = useRef(new Map<string, number>());
    const { files: allFiles, isLoading } = useFiles({
        owner,
        repo,
        number,
        commitSha,
    });
    const files = allFiles.slice(0, 500);
    const truncated = allFiles.length > 500;

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
            {isLoading && files.length === 0 && (
                <>
                    <FileDiffSkeleton />
                    <FileDiffSkeleton />
                    <FileDiffSkeleton />
                </>
            )}
            <div className="flex flex-col gap-6">
                {files.map((file) => {
                    const fileComments = allCommentsAll.filter(
                        (c) => c.path === file.filename,
                    );
                    const fileId = file.filename.replace(/\//g, "-");

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
                                baseSha={baseSha}
                                headSha={headSha}
                                comments={fileComments}
                                file={file}
                                number={number.toString()}
                                onToggleGeneratedDiff={() =>
                                    toggleGeneratedFile(file.filename)
                                }
                                owner={owner}
                                pendingReviewId={pendingReviewId}
                                repo={repo}
                                showComments={showComments}
                                showGeneratedDiff={expandedGeneratedFiles.has(
                                    file.filename,
                                )}
                            />
                        </LazyRenderItem>
                    );
                })}
            </div>
            {truncated && (
                <p className="mt-6 text-gray-500 text-sm dark:text-gray-400">
                    Showing first 500 of {allFiles.length} changed files.
                </p>
            )}
        </div>
    );
}
