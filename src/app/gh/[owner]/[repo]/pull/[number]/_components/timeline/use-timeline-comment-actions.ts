import type { InfiniteData } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { ReactionContent } from "~/lib/reactions";
import { toggleReactionInList } from "~/lib/reactions";
import { TIMELINE_PAGE_SIZE } from "~/lib/timeline-constants";
import type { TimelineResult } from "~/server/api/routers/timeline";
import type { GQLTimelineEvent } from "~/server/github-graphql";
import { api } from "~/trpc/react";

interface PullScope {
    owner: string;
    repo: string;
    number: number;
}

function timelineInput(scope: PullScope) {
    return { ...scope, limit: TIMELINE_PAGE_SIZE };
}

/**
 * Optimistic reaction surgery across every cached timeline page: flips the
 * current user's reaction of `content` under `key`, leaving other users'
 * reactions untouched.
 */
export function applyReactionToggle(
    data: InfiniteData<TimelineResult, TimelinePageParam>,
    key: string,
    login: string,
    content: ReactionContent,
): InfiniteData<TimelineResult, TimelinePageParam> {
    return {
        ...data,
        pages: data.pages.map((page) => {
            if (!(key in page.commentReactions)) {
                return page;
            }
            return {
                ...page,
                commentReactions: {
                    ...page.commentReactions,
                    [key]: toggleReactionInList(
                        page.commentReactions[key] ?? [],
                        login,
                        content,
                    ),
                },
            };
        }),
    };
}

/**
 * Bodies saved optimistically while an edit or task-list toggle is in
 * flight, keyed by comment/review id. A failed update drops its entry so
 * the UI falls back to the original text.
 */
export interface SavedBodiesStore {
    savedBodies: Record<number, string>;
    save(id: number, body: string): void;
    discard(id: number): void;
}

export function useSavedBodies(): SavedBodiesStore {
    const [savedBodies, setSavedBodies] = useState<Record<number, string>>({});
    const save = useCallback((id: number, body: string) => {
        setSavedBodies((prev) => ({ ...prev, [id]: body }));
    }, []);
    const discard = useCallback((id: number) => {
        setSavedBodies((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    }, []);
    return { savedBodies, save, discard };
}

export interface EditFlowTransitions {
    /** Runs after an optimistic save; the inline editor closes. */
    onSaved?: () => void;
    /** Runs when the update fails; the inline editor reopens on the item. */
    onResumeEdit?: (id: number) => void;
}

function useBodyUpdateHandlers(
    store: SavedBodiesStore,
    transitions: EditFlowTransitions | undefined,
) {
    return {
        onSave(id: number, body: string) {
            store.save(id, body);
            transitions?.onSaved?.();
        },
        onFail(id: number) {
            store.discard(id);
            transitions?.onResumeEdit?.(id);
        },
    };
}

/** Inline comment edit: optimistic body overlay plus editor transitions. */
export function useUpdateCommentBody(
    store: SavedBodiesStore,
    transitions?: EditFlowTransitions,
) {
    const handlers = useBodyUpdateHandlers(store, transitions);
    return api.pulls.updateComment.useMutation({
        onMutate: ({ commentId, body }) => handlers.onSave(commentId, body),
        onError: (_error, { commentId }) => handlers.onFail(commentId),
    });
}

/** Inline review-body edit: optimistic body overlay plus editor transitions. */
export function useUpdateReviewBody(
    store: SavedBodiesStore,
    transitions?: EditFlowTransitions,
) {
    const handlers = useBodyUpdateHandlers(store, transitions);
    return api.pulls.updateReview.useMutation({
        onMutate: ({ reviewId, body }) => handlers.onSave(reviewId, body),
        onError: (_error, { reviewId }) => handlers.onFail(reviewId),
    });
}

/**
 * Task-list checkbox toggles share the optimistic body overlay with the
 * edit flow but never touch editor state.
 */
export function useCommentTaskToggle(store: SavedBodiesStore) {
    return api.pulls.updateComment.useMutation({
        onMutate: ({ commentId, body }) => store.save(commentId, body),
        onError: (_error, { commentId }) => store.discard(commentId),
    });
}

export function useReviewTaskToggle(store: SavedBodiesStore) {
    return api.pulls.updateReview.useMutation({
        onMutate: ({ reviewId, body }) => store.save(reviewId, body),
        onError: (_error, { reviewId }) => store.discard(reviewId),
    });
}

type TimelinePageParam = string | null;

interface ReactionToggleCore {
    toggle(
        subjectKey: string | null,
        content: ReactionContent,
    ): Promise<{ restore: () => void } | undefined>;
    settle(): void;
}

/**
 * Optimistic reaction toggle against the cached timeline list. The comment
 * and review variants differ only in endpoint and cache-key prefix
 * (`comment:` / `review:`); both roll back the snapshot when the request
 * fails and invalidate on settle. Pass `issueNumber` to target an issue
 * timeline instead of a pull request timeline.
 */
function useReactionToggleCore(
    scope: PullScope,
    currentUserLogin: string | null,
    issueNumber?: number,
): ReactionToggleCore {
    const utils = api.useUtils();

    const toggle = async (
        subjectKey: string | null,
        content: ReactionContent,
    ) => {
        if (!currentUserLogin || !subjectKey) {
            return undefined;
        }
        if (issueNumber !== undefined) {
            const input = {
                owner: scope.owner,
                repo: scope.repo,
                issueNumber,
                limit: TIMELINE_PAGE_SIZE,
            };
            await utils.issues.timeline.cancel(input);

            const prevData = utils.issues.timeline.getInfiniteData(input);

            utils.issues.timeline.setInfiniteData(input, (old) =>
                old
                    ? applyReactionToggle(
                          old,
                          subjectKey,
                          currentUserLogin,
                          content,
                      )
                    : old,
            );

            return {
                restore: () => {
                    if (prevData) {
                        utils.issues.timeline.setInfiniteData(input, prevData);
                    }
                },
            };
        }
        await utils.timeline.list.cancel(timelineInput(scope));

        const prevData = utils.timeline.list.getInfiniteData(
            timelineInput(scope),
        );

        utils.timeline.list.setInfiniteData(timelineInput(scope), (old) =>
            old
                ? applyReactionToggle(
                      old,
                      subjectKey,
                      currentUserLogin,
                      content,
                  )
                : old,
        );

        return {
            restore: () => {
                if (prevData) {
                    utils.timeline.list.setInfiniteData(
                        timelineInput(scope),
                        prevData,
                    );
                }
            },
        };
    };

    const settle = () => {
        if (issueNumber !== undefined) {
            utils.issues.timeline.invalidate({
                owner: scope.owner,
                repo: scope.repo,
                issueNumber,
                limit: TIMELINE_PAGE_SIZE,
            });
            return;
        }
        utils.timeline.list.invalidate(timelineInput(scope));
    };

    return { toggle, settle };
}

export function useIssueCommentReactionToggle(
    scope: PullScope,
    currentUserLogin: string | null,
    issueNumber?: number,
) {
    const core = useReactionToggleCore(scope, currentUserLogin, issueNumber);
    return api.reactions.toggleIssueComment.useMutation({
        onMutate: ({ commentId, content }) =>
            core.toggle(`comment:${commentId}`, content),
        onError: (_error, _vars, ctx) => ctx?.restore(),
        onSettled: core.settle,
    });
}

export function usePullRequestReviewReactionToggle(
    scope: PullScope,
    currentUserLogin: string | null,
) {
    const core = useReactionToggleCore(scope, currentUserLogin);
    return api.reactions.togglePullRequestReview.useMutation({
        onMutate: ({ databaseId, content }) =>
            core.toggle(databaseId ? `review:${databaseId}` : null, content),
        onError: (_error, _vars, ctx) => ctx?.restore(),
        onSettled: core.settle,
    });
}

function withoutDeletedComment(
    events: GQLTimelineEvent[],
    commentId: number,
): GQLTimelineEvent[] {
    return events.filter(
        (event) =>
            event.__typename !== "IssueComment" ||
            event.databaseId !== commentId,
    );
}

/**
 * Optimistic issue-comment delete against the cached timeline list.
 * Pass `issueNumber` to target an issue timeline instead of pull request.
 */
export function useDeleteTimelineComment(
    scope: PullScope,
    issueNumber?: number,
) {
    const utils = api.useUtils();
    return api.pulls.deleteComment.useMutation({
        onMutate: async ({ commentId }) => {
            if (issueNumber !== undefined) {
                const input = {
                    owner: scope.owner,
                    repo: scope.repo,
                    issueNumber,
                    limit: TIMELINE_PAGE_SIZE,
                };
                await utils.issues.timeline.cancel(input);

                const prevData = utils.issues.timeline.getInfiniteData(input);

                utils.issues.timeline.setInfiniteData(input, (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        pages: old.pages.map((page) => ({
                            ...page,
                            events: withoutDeletedComment(
                                page.events,
                                commentId,
                            ),
                        })),
                    };
                });

                return {
                    restore: () => {
                        if (prevData) {
                            utils.issues.timeline.setInfiniteData(
                                input,
                                prevData,
                            );
                        }
                    },
                };
            }
            await utils.timeline.list.cancel({
                owner: scope.owner,
                repo: scope.repo,
                number: scope.number,
                limit: TIMELINE_PAGE_SIZE,
            });

            const prevData = utils.timeline.list.getInfiniteData({
                owner: scope.owner,
                repo: scope.repo,
                number: scope.number,
                limit: TIMELINE_PAGE_SIZE,
            });

            utils.timeline.list.setInfiniteData(
                {
                    owner: scope.owner,
                    repo: scope.repo,
                    number: scope.number,
                    limit: TIMELINE_PAGE_SIZE,
                },
                (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        pages: old.pages.map((page) => ({
                            ...page,
                            events: withoutDeletedComment(
                                page.events,
                                commentId,
                            ),
                        })),
                    };
                },
            );

            return {
                restore: () => {
                    if (prevData) {
                        utils.timeline.list.setInfiniteData(
                            {
                                owner: scope.owner,
                                repo: scope.repo,
                                number: scope.number,
                                limit: TIMELINE_PAGE_SIZE,
                            },
                            prevData,
                        );
                    }
                },
            };
        },
        onError: (_err, _vars, ctx) => ctx?.restore(),
        onSettled: () => {
            if (issueNumber !== undefined) {
                utils.issues.timeline.invalidate({
                    owner: scope.owner,
                    repo: scope.repo,
                    issueNumber,
                    limit: TIMELINE_PAGE_SIZE,
                });
                return;
            }
            utils.timeline.list.invalidate({
                owner: scope.owner,
                repo: scope.repo,
                number: scope.number,
                limit: TIMELINE_PAGE_SIZE,
            });
        },
    });
}
