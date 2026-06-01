"use client";

import { useEffect, useMemo } from "react";
import type { GQLReactionNode } from "~/server/github-graphql";
import { api } from "~/trpc/react";
import { CommentForm } from "./comment-form";
import { TimelineEvent } from "./timeline-event";
import { aggregateEvents, filterTimelineEvents } from "./timeline-utils";

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
    if (isLoading) {
        return (
            <div className="py-4 text-gray-500 text-sm dark:text-gray-400">
                Loading timeline...
            </div>
        );
    }

    const currentUserLogin = data?.pages[0]?.currentUserLogin ?? "";
    const filteredEvents = filterTimelineEvents(allEvents);

    const wrappers = aggregateEvents(filteredEvents);

    return (
        <div className="mt-4 border-gray-200 border-t pt-6 dark:border-zinc-700">
            <h2 className="mb-4 font-semibold text-gray-900 text-lg dark:text-gray-100">
                Timeline
            </h2>

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
                    return (
                        <TimelineEvent
                            wrapper={wrapper}
                            key={key}
                            number={number}
                            owner={owner}
                            repo={repo}
                            commentReactions={allCommentReactions}
                            currentUserLogin={currentUserLogin}
                            allComments={allComments}
                            canInteract={canInteract}
                        />
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
