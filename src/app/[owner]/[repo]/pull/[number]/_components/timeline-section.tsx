"use client";

import { useEffect, useMemo, useRef } from "react";
import { LazyRenderItem } from "~/components/LazyRenderItem";
import type { ReviewComment } from "~/server/github";
import type { GQLReactionNode } from "~/server/github-graphql";
import { api } from "~/trpc/react";
import { CommentForm } from "./comment-form";
import { TimelineEvent } from "./timeline-event";
import { aggregateEvents, filterTimelineEvents } from "./timeline-utils";

export function TimelineSkeleton() {
    const items = [
        { key: "w-24", text: "w-48", body: true },
        { key: "w-20", text: "w-36", body: false },
        { key: "w-28", text: "w-56", body: true },
    ];
    return (
        <div className="relative">
            <div className="absolute top-0 bottom-0 left-6 w-px bg-gray-200 dark:bg-zinc-700" />
            <div className="space-y-6 pl-14">
                {items.map((item) => (
                    <div key={item.key}>
                        <div className="flex items-center gap-2">
                            <div
                                className="h-2.5 animate-pulse rounded bg-gray-200 dark:bg-zinc-700"
                                style={{ width: "40px" }}
                            />
                            <div
                                className={`h-4 animate-pulse rounded bg-gray-200 dark:bg-zinc-700 ${item.text}`}
                            />
                        </div>
                        {item.body && (
                            <div className="mt-2 space-y-1.5">
                                <div className="h-3.5 w-full animate-pulse rounded bg-gray-100 dark:bg-zinc-800" />
                                <div className="h-3.5 w-3/4 animate-pulse rounded bg-gray-100 dark:bg-zinc-800" />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

interface TimelineSectionProps {
    owner: string;
    repo: string;
    number: number;
    canInteract: boolean;
}

export function TimelineSection({
    owner,
    repo,
    number,
    canInteract,
}: TimelineSectionProps) {
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
        api.timeline.list.useInfiniteQuery(
            { owner, repo, number, limit: 100 },
            {
                getNextPageParam: (lastPage) => lastPage.nextCursor,
            },
        );

    useEffect(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const { data: allComments = [] } = api.reviewComments.list.useQuery(
        { owner, repo, number },
        { staleTime: 30_000 },
    );

    const allEvents = useMemo(
        () => data?.pages.flatMap((page) => page.events) ?? [],
        [data],
    );
    const allCommentReactions = useMemo(
        () =>
            data?.pages.reduce<Record<number, GQLReactionNode[]>>(
                (acc, page) => {
                    for (const [id, reactions] of Object.entries(
                        page.commentReactions,
                    )) {
                        acc[Number(id)] = reactions;
                    }
                    return acc;
                },
                {} as Record<number, GQLReactionNode[]>,
            ) ?? {},
        [data],
    );

    const heightMapRef = useRef(new Map<string, number>());

    const reviewThreadIds = useMemo(() => {
        const map = new Map<number, string[]>();
        for (const c of allComments as ReviewComment[]) {
            const reviewId = c.pull_request_review_id;
            if (!reviewId) continue;
            const list = map.get(reviewId) ?? [];
            list.push(`review-thread-${c.id}`);
            map.set(reviewId, list);
        }
        return map;
    }, [allComments]);

    if (isLoading) {
        return (
            <div className="mt-5">
                <TimelineSkeleton />
            </div>
        );
    }

    const currentUserLogin = data?.pages[0]?.currentUserLogin ?? "";
    const filteredEvents = filterTimelineEvents(allEvents);

    const wrappers = aggregateEvents(filteredEvents);

    return (
        <div className="mt-5">
            {wrappers.length === 0 && (
                <p className="text-gray-500 text-sm dark:text-gray-400">
                    No timeline events yet.
                </p>
            )}

            <div className="relative">
                <div className="absolute top-0 bottom-0 left-6 w-px bg-gray-200 dark:bg-zinc-700" />

                {wrappers.map((wrapper, index) => {
                    const key =
                        wrapper.type === "raw"
                            ? `raw-${wrapper.event.id}-${index}`
                            : `label-${wrapper.createdAt}-${index}`;

                    let renderOnIds: string[] | undefined;
                    if (
                        wrapper.type === "raw" &&
                        wrapper.event.__typename === "PullRequestReview"
                    ) {
                        renderOnIds = reviewThreadIds.get(
                            wrapper.event.databaseId,
                        );
                    }

                    return (
                        <LazyRenderItem
                            itemKey={key}
                            heightMap={heightMapRef.current}
                            key={key}
                            extraHeight={32}
                            renderOnIds={renderOnIds}
                        >
                            <TimelineEvent
                                wrapper={wrapper}
                                number={number}
                                owner={owner}
                                repo={repo}
                                commentReactions={allCommentReactions}
                                currentUserLogin={currentUserLogin}
                                allComments={allComments}
                                canInteract={canInteract}
                            />
                        </LazyRenderItem>
                    );
                })}
            </div>

            {isFetchingNextPage && (
                <div className="py-4 text-center">
                    <p className="text-gray-500 text-sm dark:text-gray-400">
                        Loading more...
                    </p>
                </div>
            )}

            <CommentForm
                disabled={!canInteract}
                number={number}
                owner={owner}
                repo={repo}
            />
        </div>
    );
}
