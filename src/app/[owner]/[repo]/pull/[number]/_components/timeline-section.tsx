"use client";

import { useEffect } from "react";
import type {
    GQLReactionNode,
    GQLTimelineEvent,
} from "~/server/github-graphql";
import { api } from "~/trpc/react";
import { CommentForm } from "./comment-form";
import { TimelineEvent } from "./timeline-event";
import type { LabelChange, TimelineWrapper } from "./timeline-types";

function deduplicateChanges(changes: LabelChange[]): LabelChange[] {
    const seen = new Set<string>();
    const result: LabelChange[] = [];

    for (const c of changes) {
        const key = `${c.label.name}:${c.event}`;
        if (!seen.has(key)) {
            seen.add(key);
            result.push(c);
        }
    }

    return result;
}

const MAX_LABEL_GAP_MS = 3 * 60 * 60 * 1000;

function aggregateEvents(events: GQLTimelineEvent[]): TimelineWrapper[] {
    const result: TimelineWrapper[] = [];
    let i = 0;

    while (i < events.length) {
        const event = events[i]!;

        if (
            event.__typename === "LabeledEvent" ||
            event.__typename === "UnlabeledEvent"
        ) {
            const changes: LabelChange[] = [];

            while (i < events.length) {
                const current = events[i]!;
                if (
                    current.__typename !== "LabeledEvent" &&
                    current.__typename !== "UnlabeledEvent"
                ) {
                    break;
                }
                if (changes.length > 0) {
                    const gap =
                        new Date(current.createdAt).getTime() -
                        new Date(
                            changes[changes.length - 1]!.createdAt,
                        ).getTime();
                    if (gap > MAX_LABEL_GAP_MS) break;
                }

                if (current.label && current.actor) {
                    changes.push({
                        label: {
                            name: current.label.name,
                            color: current.label.color,
                        },
                        event:
                            current.__typename === "LabeledEvent"
                                ? "labeled"
                                : "unlabeled",
                        actor: current.actor,
                        createdAt: current.createdAt,
                    });
                }
                i++;
            }

            if (changes.length > 0) {
                const deduped = deduplicateChanges(changes);
                if (deduped.length === 0) continue;
                const lastChange = changes[changes.length - 1]!;
                result.push({
                    type: "aggregated-label",
                    changes: deduped,
                    actor: lastChange.actor,
                    createdAt: lastChange.createdAt,
                });
            }
        } else {
            result.push({ type: "raw", event: event });
            i++;
        }
    }

    return result;
}

interface TimelineSectionProps {
    owner: string;
    repo: string;
    number: number;
}

export function TimelineSection({ owner, repo, number }: TimelineSectionProps) {
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

    if (isLoading) {
        return (
            <div className="py-4 text-gray-500 text-sm dark:text-gray-400">
                Loading timeline...
            </div>
        );
    }

    const allEvents = data?.pages.flatMap((page) => page.events) ?? [];
    const allCommentReactions =
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
        ) ?? {};
    const currentUserLogin = data?.pages[0]?.currentUserLogin ?? "";
    const filteredEvents = allEvents.filter((event) => {
        if (
            event.__typename === "MentionedEvent" ||
            event.__typename === "SubscribedEvent"
        ) {
            return false;
        }
        return true;
    });

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

            <CommentForm number={number} owner={owner} repo={repo} />
        </div>
    );
}
