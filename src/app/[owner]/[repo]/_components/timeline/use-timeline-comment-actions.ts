import type { InfiniteData } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { ReactionContent } from "~/lib/reactions";
import { toggleReactionInList } from "~/lib/reactions";
import { TIMELINE_PAGE_SIZE } from "~/lib/timeline-constants";
import type { TimelineResult } from "~/server/api/routers/timeline";
import type {
    GQLIssueComment,
    GQLTimelineEvent,
} from "~/server/github-graphql";
import { api } from "~/trpc/react";
import { domain, type Provider } from "~/utils/provider-url";

export interface PullScope {
    owner: string;
    repo: string;
    number: number;
}

export interface IssueScope {
    provider: Provider;
    owner: string;
    repo: string;
    issueNumber: number;
}

export type TimelineScope = PullScope | IssueScope;

export type TimelineCacheData = InfiniteData<TimelineResult, TimelinePageParam>;

export interface TimelineListCache {
    cancel: () => Promise<void>;
    get: () => TimelineCacheData | undefined;
    set: (
        updater: (
            old: TimelineCacheData | undefined,
        ) => TimelineCacheData | undefined,
    ) => void;
    invalidate: () => void;
}

/**
 * Scope-parameterized access to the cached infinite timeline list. Both the
 * pull request timeline and the issue timeline store TimelineResult pages,
 * so one handle serves optimistic updates for either scope.
 */
export function useTimelineListCache(scope: TimelineScope): TimelineListCache {
    const utils = api.useUtils();
    if ("issueNumber" in scope) {
        const input = {
            provider: scope.provider,
            owner: scope.owner,
            repo: scope.repo,
            issueNumber: scope.issueNumber,
            limit: TIMELINE_PAGE_SIZE,
        };
        const proc = utils.issues.timeline;
        return {
            cancel: () => proc.cancel(input),
            get: () => proc.getInfiniteData(input),
            set: (updater) => proc.setInfiniteData(input, updater),
            invalidate: () => proc.invalidate(input),
        };
    }
    const input = { ...scope, limit: TIMELINE_PAGE_SIZE };
    const proc = utils.timeline.list;
    return {
        cancel: () => proc.cancel(input),
        get: () => proc.getInfiniteData(input),
        set: (updater) => proc.setInfiniteData(input, updater),
        invalidate: () => proc.invalidate(input),
    };
}

export function buildOptimisticComment(
    body: string,
    author: { login: string; avatarUrl: string },
    provider: Provider,
): GQLIssueComment {
    const tempId = -Date.now();
    return {
        __typename: "IssueComment",
        id: `optimistic-issue-comment-${Math.abs(tempId)}`,
        databaseId: tempId,
        body,
        author: {
            __typename: "User",
            login: author.login,
            avatarUrl: author.avatarUrl,
            url: `https://${domain(provider)}/${author.login}`,
        },
        createdAt: new Date().toISOString(),
        authorAssociation: "NONE",
        isMinimized: false,
        minimizedReason: null,
        reactions: { nodes: [] },
    };
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
 * fails and invalidate on settle.
 */
function useReactionToggleCore(
    scope: TimelineScope,
    currentUserLogin: string | null,
): ReactionToggleCore {
    const cache = useTimelineListCache(scope);

    const toggle = async (
        subjectKey: string | null,
        content: ReactionContent,
    ) => {
        if (!currentUserLogin || !subjectKey) {
            return undefined;
        }
        await cache.cancel();

        const prevData = cache.get();

        cache.set((old) =>
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
                    cache.set(() => prevData);
                }
            },
        };
    };

    const settle = () => {
        cache.invalidate();
    };

    return { toggle, settle };
}

export function useIssueCommentReactionToggle(
    scope: TimelineScope,
    currentUserLogin: string | null,
) {
    const core = useReactionToggleCore(scope, currentUserLogin);
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
 */
export function useDeleteTimelineComment(scope: TimelineScope) {
    const cache = useTimelineListCache(scope);
    return api.pulls.deleteComment.useMutation({
        onMutate: async ({ commentId }) => {
            await cache.cancel();

            const prevData = cache.get();

            cache.set((old) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        events: withoutDeletedComment(page.events, commentId),
                    })),
                };
            });

            return {
                restore: () => {
                    if (prevData) {
                        cache.set(() => prevData);
                    }
                },
            };
        },
        onError: (_err, _vars, ctx) => ctx?.restore(),
        onSettled: () => {
            cache.invalidate();
        },
    });
}
