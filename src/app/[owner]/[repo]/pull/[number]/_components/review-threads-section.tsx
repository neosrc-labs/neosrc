"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { CheckCircle, Circle, MessageSquare } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
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

function scrollToComment(commentId: number) {
    const id = `review-thread-${commentId}`;
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
                <p className="truncate text-gray-700 text-sm dark:text-zinc-300">
                    {truncateBody(root.body)}
                </p>
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
    const { data: threads, isLoading } = api.reviewComments.threads.useQuery(
        { owner, repo, number },
        { staleTime: 30_000 },
    );

    const scrollRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: threads?.length ?? 0,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => THREAD_ITEM_HEIGHT,
        overscan: 5,
    });

    if (isLoading) {
        return (
            <div className="space-y-1">
                <ThreadSkeleton />
                <ThreadSkeleton />
                <ThreadSkeleton />
            </div>
        );
    }

    if (!threads || threads.length === 0) {
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
        </div>
    );
}
