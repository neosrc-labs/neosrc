"use client";

import { type Dispatch, type SetStateAction, useMemo } from "react";
import {
    createReviewCommentStub,
    findAuthorAssociation,
} from "~/components/review-comment-utils";
import { savedBodyMutationHandlers } from "~/components/saved-body-mutations";
import {
    applyReviewThreadOperations,
    useReviewThreadOperations,
} from "~/hooks/use-review-thread-operations";
import { removeCommentFromFlatList } from "~/lib/review-comment-cache-utils";
import type { ReviewCommentBase } from "~/server/github";
import { api } from "~/trpc/react";

type ReviewCommentsKey = {
    owner: string;
    repo: string;
    number: number;
};

export type ReviewCommentsUtils = ReturnType<typeof api.useUtils>;

/**
 * The two update mutations shared by every review-comment surface: an
 * edit-save mutation (closes/reopens the editor) and a task-toggle mutation
 * (only overlays the body). Both apply the optimistic `savedBodies` overlay
 * and roll it back on error.
 */
export function useReviewCommentEditMutations({
    setSavedBodies,
    setEditingCommentId,
}: {
    setSavedBodies: Dispatch<SetStateAction<Record<number, string>>>;
    setEditingCommentId?: Dispatch<SetStateAction<number | null>>;
}) {
    const updateMutation = api.reviewComments.update.useMutation(
        savedBodyMutationHandlers({
            idKey: "commentId",
            setSavedBodies,
            setEditingCommentId,
        }),
    );
    const taskToggleMutation = api.reviewComments.update.useMutation(
        savedBodyMutationHandlers({ idKey: "commentId", setSavedBodies }),
    );
    return { updateMutation, taskToggleMutation };
}

/**
 * Shared threads/resolution state for a pull request: the resolved-thread
 * query, resolve mutation wiring, and a commentId -> thread lookup map. Used
 * by both the review-comments list (timeline reviews) and inline diff threads.
 */
export function useReviewThreads({ owner, repo, number }: ReviewCommentsKey) {
    const { data: threads, isPending: threadsPending } =
        api.reviewComments.threads.useQuery(
            { owner, repo, number },
            { staleTime: 30_000 },
        );

    const resolveOps = useReviewThreadOperations({ owner, repo, number });
    const displayThreads = applyReviewThreadOperations(
        threads,
        resolveOps.operations,
    );

    const threadByCommentId = useMemo(() => {
        const map = new Map<
            number,
            NonNullable<typeof displayThreads>[number]
        >();
        if (!displayThreads) return map;
        for (const thread of displayThreads) {
            for (const c of thread.comments) {
                map.set(c.id, thread);
            }
        }
        return map;
    }, [displayThreads]);

    return { threadsPending, threadByCommentId, resolveOps };
}

interface UseReviewCommentReplyMutationOptions {
    owner: string;
    repo: string;
    number: number;
    /** The comment being replied to; its file position anchors the stub. */
    anchor: Pick<ReviewCommentBase, "path" | "line" | "side">;
    currentUser: { login?: string; avatarUrl: string } | null | undefined;
    /** Runs at the start of mutate (closes the reply form / clears its text). */
    onStart: () => void;
    /** Runs on successful reply (clears the autosaved draft). */
    onSuccess: () => void;
}

/**
 * Optimistic reply mutation shared by review-comments and inline diff threads:
 * immediately appends a local stub comment, rolls back on error, and
 * invalidates the comment list on settle.
 */
export function useReviewCommentReplyMutation({
    owner,
    repo,
    number,
    anchor,
    currentUser,
    onStart,
    onSuccess,
}: UseReviewCommentReplyMutationOptions) {
    const utils = api.useUtils();

    return api.reviewComments.reply.useMutation({
        onMutate: async ({ body, inReplyTo }) => {
            onStart();

            await utils.reviewComments.list.cancel({ owner, repo, number });
            const prevData = utils.reviewComments.list.getData({
                owner,
                repo,
                number,
            });

            const userLogin = currentUser?.login;
            if (userLogin) {
                const listData = utils.reviewComments.list.getData({
                    owner,
                    repo,
                    number,
                });
                const pendingData = utils.reviews.getPending.getData({
                    owner,
                    repo,
                    number,
                });
                const authorAssociation =
                    findAuthorAssociation(listData ?? [], userLogin) ??
                    findAuthorAssociation(
                        pendingData?.comments ?? [],
                        userLogin,
                    );

                const stub = createReviewCommentStub({
                    body,
                    filePath: anchor.path,
                    currentUser: {
                        login: userLogin,
                        avatarUrl: currentUser.avatarUrl,
                    },
                    lineNumber: anchor.line,
                    side: anchor.side,
                    inReplyTo,
                    authorAssociation,
                });

                utils.reviewComments.list.setData(
                    { owner, repo, number },
                    (old) => {
                        if (!old) return old;
                        return [...old, stub];
                    },
                );
            }

            return { prevData };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prevData) {
                utils.reviewComments.list.setData(
                    { owner, repo, number },
                    ctx.prevData,
                );
            }
        },
        onSuccess: () => {
            onSuccess();
        },
        onSettled: () => {
            utils.reviewComments.list.invalidate({
                owner,
                repo,
                number,
            });
        },
    });
}

/**
 * Cancels the comment-list and pending-review queries and snapshots their
 * data so a delete mutation can roll back.
 */
export async function captureReviewCommentLists(
    utils: ReviewCommentsUtils,
    key: ReviewCommentsKey,
) {
    await utils.reviewComments.list.cancel(key);
    const prevListData = utils.reviewComments.list.getData(key);

    await utils.reviews.getPending.cancel(key);
    const prevPendingData = utils.reviews.getPending.getData(key);

    return { prevListData, prevPendingData };
}

export type CapturedReviewCommentLists = Awaited<
    ReturnType<typeof captureReviewCommentLists>
>;

/** Optimistically remove a comment from the flat list and the pending review. */
export function removeReviewCommentFromLists(
    utils: ReviewCommentsUtils,
    key: ReviewCommentsKey,
    commentId: number,
) {
    utils.reviewComments.list.setData(key, (old) => {
        if (!old) return old;
        return removeCommentFromFlatList(old, commentId);
    });

    utils.reviews.getPending.setData(key, (old) => {
        if (!old) return old;
        return {
            ...old,
            comments: removeCommentFromFlatList(old.comments, commentId),
        };
    });
}

export function restoreReviewCommentLists(
    utils: ReviewCommentsUtils,
    key: ReviewCommentsKey,
    captured: CapturedReviewCommentLists | undefined,
) {
    if (captured?.prevListData) {
        utils.reviewComments.list.setData(key, captured.prevListData);
    }
    if (captured?.prevPendingData) {
        utils.reviews.getPending.setData(key, captured.prevPendingData);
    }
}

export function invalidateReviewCommentLists(
    utils: ReviewCommentsUtils,
    key: ReviewCommentsKey,
) {
    utils.reviewComments.list.invalidate(key);
    utils.reviews.getPending.invalidate(key);
}
