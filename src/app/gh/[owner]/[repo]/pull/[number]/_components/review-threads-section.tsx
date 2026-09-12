"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { CheckCircle, Circle, Code2, MessageSquare } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef } from "react";
import { cn } from "~/lib/utils";
import type { ReviewThreadSummary } from "~/server/github";
import { api } from "~/trpc/react";
import { bucketReviewThreads } from "./review-thread-groups";

const HEADER_ITEM_HEIGHT = 28;
const THREAD_ITEM_HEIGHT = 50;

type ThreadListItem =
    | {
          kind: "header";
          id: string;
          label: string;
          color: string;
          count: number;
      }
    | { kind: "thread"; id: string; thread: ReviewThreadSummary };

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

    const el = document.getElementById(id);
    if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("review-thread-highlight");
        return;
    }

    const observer = new MutationObserver(() => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("review-thread-highlight");
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 15000);
}

interface ThreadCardProps {
    thread: ReviewThreadSummary;
}

function ThreadCard({ thread }: ThreadCardProps) {
    const root = thread.root;

    if (!root) return null;

    const handleClick = () => {
        scrollToComment(root.id);
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            className={[
                "flex w-full cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-tertiary",
                thread.isResolved && "opacity-60",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {root.author?.avatarUrl ? (
                <Image
                    alt={`${root.author?.login ?? "unknown"}'s avatar`}
                    className="mt-0.5 size-5 shrink-0 rounded-full"
                    src={root.author?.avatarUrl}
                    width={20}
                    height={20}
                />
            ) : null}

            <div className="min-w-0 flex-1">
                {isSuggestionBody(root.body) ? (
                    <span className="flex items-center gap-1.5 text-sm text-text-label">
                        <Code2 className="size-3.5 shrink-0" />
                        <span
                            className={cn(
                                "truncate",
                                thread.isResolved && "line-through",
                            )}
                        >
                            Suggestion{thread.path ? ` in ${thread.path}` : ""}
                        </span>
                    </span>
                ) : (
                    <p
                        className={cn(
                            "truncate text-sm text-text-label",
                            thread.isResolved ? "line-through" : "",
                        )}
                    >
                        {truncateBody(root.body)}
                    </p>
                )}
                <div className="mt-0.5 flex items-center gap-2">
                    {thread.isResolved ? (
                        <CheckCircle className="size-3 text-green-500" />
                    ) : (
                        <Circle className="size-3 text-text-muted" />
                    )}
                    <span className="flex items-center gap-1 text-text-muted text-xs no-underline">
                        <MessageSquare className="size-3" />
                        {thread.commentCount}
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
            <div className="mt-0.5 size-5 animate-pulse rounded-full bg-surface-selected" />
            <div className="min-w-0 flex-1">
                <div className="h-4 w-full animate-pulse rounded bg-surface-selected" />
                <div className="mt-2 h-3 w-16 animate-pulse rounded bg-surface-selected" />
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

    const items = useMemo(() => {
        const list: ThreadListItem[] = [];
        for (const group of bucketReviewThreads(threads)) {
            list.push({
                kind: "header",
                id: `header-${group.label}`,
                label: group.label,
                color: group.color,
                count: group.threads.length,
            });
            for (const thread of group.threads) {
                list.push({ kind: "thread", id: thread.id, thread });
            }
        }
        return list;
    }, [threads]);

    const scrollRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: (index) =>
            items[index]?.kind === "header"
                ? HEADER_ITEM_HEIGHT
                : THREAD_ITEM_HEIGHT,
        getItemKey: (index) => items[index]?.id ?? index,
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
        return null;
    }

    return (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    position: "relative",
                }}
            >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                    const item = items[virtualItem.index];
                    if (!item) return null;
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
                            {item.kind === "header" ? (
                                <h3 className="flex h-full items-center gap-1.5 font-semibold text-text-secondary text-xs uppercase">
                                    <span
                                        className="size-2 shrink-0 rounded-full"
                                        style={{ backgroundColor: item.color }}
                                    />
                                    {item.label} ({item.count})
                                </h3>
                            ) : (
                                <ThreadCard thread={item.thread} />
                            )}
                        </div>
                    );
                })}
            </div>
            {hasNextPage && <div ref={sentinelRef} style={{ height: 1 }} />}
            {isFetchingNextPage && (
                <p className="py-2 text-center text-text-tertiary text-xs">
                    Loading more threads...
                </p>
            )}
        </div>
    );
}
