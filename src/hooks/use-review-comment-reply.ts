"use client";

import { useCallback } from "react";
import {
    createReviewCommentStub,
    findAuthorAssociation,
} from "~/components/review-comment-utils";
import type { ReviewCommentBase } from "~/server/github";
import { api } from "~/trpc/react";

interface ReviewReplyUser {
    login: string;
    avatarUrl: string;
}

export function useReviewCommentReply({
    owner,
    repo,
    number,
    parentComment,
    currentUser,
    onSuccess,
}: {
    owner: string;
    repo: string;
    number: number;
    parentComment: ReviewCommentBase;
    currentUser?: ReviewReplyUser;
    onSuccess?: () => void;
}) {
    const utils = api.useUtils();
    const mutation = api.reviewComments.reply.useMutation({
        onMutate: async ({ body, inReplyTo }) => {
            await utils.reviewComments.list.cancel({ owner, repo, number });
            const previous = utils.reviewComments.list.getData({
                owner,
                repo,
                number,
            });

            if (currentUser) {
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
                    findAuthorAssociation(listData ?? [], currentUser.login) ??
                    findAuthorAssociation(
                        pendingData?.comments ?? [],
                        currentUser.login,
                    );
                const stub = createReviewCommentStub({
                    body,
                    filePath: parentComment.path,
                    currentUser,
                    lineNumber: parentComment.line ?? undefined,
                    side: parentComment.side ?? undefined,
                    inReplyTo,
                    authorAssociation,
                });
                utils.reviewComments.list.setData(
                    { owner, repo, number },
                    (old) => (old ? [...old, stub] : old),
                );
            }

            return { previous };
        },
        onError: (_error, _variables, context) => {
            if (context?.previous) {
                utils.reviewComments.list.setData(
                    { owner, repo, number },
                    context.previous,
                );
            }
        },
        onSuccess,
        onSettled: () => {
            utils.reviewComments.list.invalidate({ owner, repo, number });
        },
    });

    const submit = useCallback(
        (body: string) => {
            if (!body.trim()) return;
            mutation.mutate({
                owner,
                repo,
                number,
                body,
                inReplyTo: parentComment.id,
            });
        },
        [mutation, number, owner, parentComment.id, repo],
    );

    return { ...mutation, submit };
}
