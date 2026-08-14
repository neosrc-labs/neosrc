"use client";

import { type ReactionContent, toggleReactionInList } from "~/lib/reactions";
import { TIMELINE_PAGE_SIZE } from "~/lib/timeline-constants";
import type { GQLTimelineEvent } from "~/server/github-graphql";
import type { api } from "~/trpc/react";

export type TimelineListKey = {
    owner: string;
    repo: string;
    number: number;
    limit: number;
};

export function timelineListKey({
    owner,
    repo,
    number,
}: {
    owner: string;
    repo: string;
    number: number;
}): TimelineListKey {
    return { owner, repo, number, limit: TIMELINE_PAGE_SIZE };
}

export type TimelineUtils = ReturnType<typeof api.useUtils>;

/** Cancel the infinite timeline query before an optimistic mutation. */
export async function cancelTimelineList(
    utils: TimelineUtils,
    key: TimelineListKey,
) {
    await utils.timeline.list.cancel(key);
}

/** Snapshot the infinite timeline data so the mutation can roll back. */
export function getTimelineListData(
    utils: TimelineUtils,
    key: TimelineListKey,
) {
    return utils.timeline.list.getInfiniteData(key);
}

/** Roll the timeline back to a snapshot captured by {@link getTimelineListData}. */
export function restoreTimelineListData(
    utils: TimelineUtils,
    key: TimelineListKey,
    prevData: ReturnType<TimelineUtils["timeline"]["list"]["getInfiniteData"]>,
) {
    if (prevData) {
        utils.timeline.list.setInfiniteData(key, prevData);
    }
}

export function invalidateTimelineList(
    utils: TimelineUtils,
    key: TimelineListKey,
) {
    utils.timeline.list.invalidate(key);
}

type TimelineMutationContext =
    | { prevData: ReturnType<typeof getTimelineListData> }
    | undefined;

/**
 * Standard `onError`/`onSettled` pair for optimistic timeline mutations: roll
 * the infinite list back to the snapshot from {@link getTimelineListData} on
 * error, then refetch on settle.
 */
export function timelineRollbackHandlers(
    utils: TimelineUtils,
    key: TimelineListKey,
) {
    return {
        onError: (
            _err: unknown,
            _vars: unknown,
            ctx: TimelineMutationContext,
        ) => {
            restoreTimelineListData(utils, key, ctx?.prevData);
        },
        onSettled: () => {
            invalidateTimelineList(utils, key);
        },
    };
}

/**
 * Optimistically drop timeline events matching `predicate` (used when a
 * comment or review is deleted).
 */
export function filterTimelineEvents(
    utils: TimelineUtils,
    key: TimelineListKey,
    predicate: (event: GQLTimelineEvent) => boolean,
) {
    utils.timeline.list.setInfiniteData(key, (old) => {
        if (!old) return old;
        return {
            ...old,
            pages: old.pages.map((page) => ({
                ...page,
                events: page.events.filter(predicate),
            })),
        };
    });
}

/**
 * Optimistically toggle a reaction in the timeline's per-entity reaction map
 * (entity id is a comment id or a review database id depending on the caller).
 */
export function toggleTimelineCommentReactions(
    utils: TimelineUtils,
    key: TimelineListKey,
    entityId: number,
    userLogin: string,
    content: ReactionContent,
) {
    utils.timeline.list.setInfiniteData(key, (old) => {
        if (!old) return old;
        return {
            ...old,
            pages: old.pages.map((page) => {
                if (!(entityId in page.commentReactions)) return page;
                return {
                    ...page,
                    commentReactions: {
                        ...page.commentReactions,
                        [entityId]: toggleReactionInList(
                            page.commentReactions[entityId] ?? [],
                            userLogin,
                            content,
                        ),
                    },
                };
            }),
        };
    });
}

/**
 * Optimistically set the minimized state of a review in the timeline (used by
 * the minimize/unminimize mutations).
 */
export function updateReviewMinimizedInTimeline(
    utils: TimelineUtils,
    key: TimelineListKey,
    subjectId: string,
    isMinimized: boolean,
    minimizedReason: string | null,
) {
    utils.timeline.list.setInfiniteData(key, (old) => {
        if (!old) return old;
        return {
            ...old,
            pages: old.pages.map((page) => ({
                ...page,
                events: page.events.map((ev) =>
                    ev.__typename === "PullRequestReview" && ev.id === subjectId
                        ? { ...ev, isMinimized, minimizedReason }
                        : ev,
                ),
            })),
        };
    });
}
