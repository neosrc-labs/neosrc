"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { CheckCircle, Circle, Code2, MessageSquare } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { SCROLL_TARGET_EVENT } from "~/components/LazyRenderItem";
import type { ReviewThreadData } from "~/server/github";
import { api } from "~/trpc/react";

const THREAD_ITEM_HEIGHT = 50;

function groupThread(thread: ReviewThreadData) {
    const root =
        thread.comments.find((c) => c.replyToId === null) ?? thread.comments[0];
    return { root };
}

function truncateBody(body: string, maxLen = 80): string {
    const firstLine = body.split("\n")[0] ?? "";
    if (firstLine.length <= maxLen) return firstLine;
    return `${firstLine.slice(0, maxLen).trim()}…`;
}

function isSuggestionBody(body: string): boolean {
    return /```suggestion\b/.test(body);
}

function scrollToComment(commentId: number) {
    const id = `review-thread-${commentId}`;
    window.dispatchEvent(new CustomEvent(SCROLL_TARGET_EVENT, { detail: id }));

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
}

interface ThreadCardProps {
    thread: ReviewThreadData;
}

function ThreadCard({ thread }: ThreadCardProps) {
    const { root } = useMemo(() => groupThread(thread), [thread]);

    const handleClick = useCallback(() => {
        if (!root) return;
        scrollToComment(root.id);
    }, [root]);

    if (!root) return null;

    return (
        <button
            type="button"
            onClick={handleClick}
            className="flex w-full cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800"
        >
            <img
                alt={`${root.author?.login ?? "unknown"}'s avatar`}
                className="mt-0.5 size-5 shrink-0 rounded-full"
                src={root.author?.avatarUrl ?? ""}
            />

            <div className="min-w-0 flex-1">
                {isSuggestionBody(root.body) ? (
                    <span className="flex items-center gap-1.5 text-gray-600 text-sm dark:text-zinc-400">
                        <Code2 className="size-3.5 shrink-0" />
                        <span className="truncate">
                            Suggestion{thread.path ? ` in ${thread.path}` : ""}
                        </span>
                    </span>
                ) : (
                    <p className="truncate text-gray-700 text-sm dark:text-zinc-300">
                        {truncateBody(root.body)}
                    </p>
                )}
                <div className="mt-0.5 flex items-center gap-2">
                    {thread.isResolved ? (
                        <CheckCircle className="size-3 text-green-500" />
                    ) : (
                        <Circle className="size-3 text-gray-400" />
                    )}
                    <span className="flex items-center gap-1 text-gray-400 text-xs">
                        <MessageSquare className="size-3" />
                        {thread.comments.length}
                    </span>
                    {thread.isOutdated && (
                        <span className="whitespace-nowrap rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-[10px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                            Outdated
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
}

function ThreadSkeleton() {
    return (
        <div className="flex items-start gap-2 rounded-md px-2 py-1.5">
            <div className="mt-0.5 size-5 animate-pulse rounded-full bg-gray-200 dark:bg-zinc-700" />
            <div className="min-w-0 flex-1">
                <div className="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                <div className="mt-2 h-3 w-16 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
            </div>
        </div>
    );
}

interface ReviewThreadsSectionProps {
    owner: string;
    repo: string;
    number: number;
}

export function ReviewThreadsSection({
    owner,
    repo,
    number,
}: ReviewThreadsSectionProps) {
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
        api.reviewComments.threadsPage.useInfiniteQuery(
            { owner, repo, number },
            {
                getNextPageParam: (lastPage) => lastPage.nextCursor,
                staleTime: 30_000,
            },
        );

    const threads = useMemo(
        () => data?.pages.flatMap((page) => page.threads) ?? [],
        [data],
    );

    const scrollRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: threads.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => THREAD_ITEM_HEIGHT,
        overscan: 5,
    });

    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = sentinelRef.current;
        const scrollEl = scrollRef.current;
        if (!el || !scrollEl || !hasNextPage) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) {
                    fetchNextPage();
                }
            },
            { root: scrollEl, rootMargin: "400px" },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [hasNextPage, fetchNextPage]);

    if (isLoading) {
        return (
            <div className="space-y-1">
                <ThreadSkeleton />
                <ThreadSkeleton />
                <ThreadSkeleton />
            </div>
        );
    }

    if (threads.length === 0) {
        return (
            <p className="text-gray-500 text-sm dark:text-zinc-400">
                No review threads
            </p>
        );
    }

    return (
        <div
            ref={scrollRef}
            className="h-full overflow-y-auto"
            style={{ contain: "strict" }}
        >
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    position: "relative",
                }}
            >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                    const thread = threads[virtualItem.index];
                    if (!thread) return null;
                    return (
                        <div
                            key={virtualItem.key}
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: `${virtualItem.size}px`,
                                transform: `translateY(${virtualItem.start}px)`,
                            }}
                        >
                            <ThreadCard thread={thread} />
                        </div>
                    );
                })}
            </div>
            {hasNextPage && <div ref={sentinelRef} style={{ height: 1 }} />}
            {isFetchingNextPage && (
                <p className="py-2 text-center text-gray-500 text-xs dark:text-gray-400">
                    Loading more threads...
                </p>
            )}
        </div>
    );
}
