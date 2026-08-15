"use client";

import { useCallback } from "react";
import { api } from "~/trpc/react";
import type { DiffCommentTarget } from "./diff/types";
import {
    createReviewCommentStub,
    findAuthorAssociation,
} from "./review-comment-utils";

export function useFileCommentActions({
    owner,
    repo,
    number,
    filename,
    pendingReviewId,
    showComments,
    commentBody,
    activeComment,
    recentlyAddedIds,
    setActiveComment,
    setCommentBody,
    onCommentSuccess,
}: {
    owner: string;
    repo: string;
    number: string;
    filename: string;
    pendingReviewId?: number | null;
    showComments: boolean;
    commentBody: string;
    activeComment: DiffCommentTarget | null;
    recentlyAddedIds: React.RefObject<Set<number>>;
    setActiveComment: (comment: DiffCommentTarget | null) => void;
    setCommentBody: (body: string) => void;
    onCommentSuccess: () => void;
}) {
    const utils = api.useUtils();
    const { data: currentUserData } = api.users.currentUser.useQuery();
    const createMutation = api.reviewComments.create.useMutation({
        onMutate: async (input) => {
            if (input.asReview) {
                await utils.reviews.getPending.cancel({
                    owner,
                    repo,
                    number: Number(number),
                });
                return {
                    prevData: utils.reviews.getPending.getData({
                        owner,
                        repo,
                        number: Number(number),
                    }),
                    isReview: true as const,
                };
            }
            await utils.reviewComments.list.cancel({
                owner,
                repo,
                number: Number(number),
            });
            return {
                prevData: utils.reviewComments.list.getData({
                    owner,
                    repo,
                    number: Number(number),
                }),
                isReview: false as const,
            };
        },
        onError: (_error, _variables, context) => {
            if (!context?.prevData) return;
            if (context.isReview) {
                utils.reviews.getPending.setData(
                    { owner, repo, number: Number(number) },
                    context.prevData,
                );
            } else {
                utils.reviewComments.list.setData(
                    { owner, repo, number: Number(number) },
                    context.prevData,
                );
            }
        },
        onSuccess: (data) => {
            onCommentSuccess();
            if (!showComments && data?.id)
                recentlyAddedIds.current.add(data.id);
        },
        onSettled: (_data, _error, input) => {
            if (input.asReview) {
                utils.reviews.getPending.invalidate({
                    owner,
                    repo,
                    number: Number(number),
                });
            } else {
                utils.reviewComments.list.invalidate({
                    owner,
                    repo,
                    number: Number(number),
                });
            }
        },
    });
    const startReviewMutation = api.reviews.start.useMutation({
        onSuccess: () => utils.reviews.getPending.invalidate(),
    });

    const handleAddComment = useCallback(
        (isReview: boolean) => {
            if (!commentBody.trim() || !activeComment) return;
            const body = commentBody;
            const savedActiveComment = activeComment;
            const args: Parameters<typeof createMutation.mutate>[0] = {
                owner,
                repo,
                number: Number(number),
                filePath: filename,
                body,
                asReview: isReview,
                ...(activeComment.type === "line"
                    ? {
                          lineNumber: activeComment.line,
                          side: activeComment.side,
                          startLineNumber: activeComment.startLine,
                          startSide: activeComment.startSide,
                      }
                    : {}),
            };
            setCommentBody("");
            setActiveComment(null);
            let previousPending:
                | Awaited<ReturnType<typeof utils.reviews.getPending.getData>>
                | undefined;
            const userLogin = currentUserData?.login;
            if (userLogin) {
                const listData = utils.reviewComments.list.getData({
                    owner,
                    repo,
                    number: Number(number),
                });
                const pendingData = utils.reviews.getPending.getData({
                    owner,
                    repo,
                    number: Number(number),
                });
                const authorAssociation =
                    findAuthorAssociation(listData ?? [], userLogin) ??
                    findAuthorAssociation(
                        pendingData?.comments ?? [],
                        userLogin,
                    );
                const stub = createReviewCommentStub({
                    body,
                    filePath: filename,
                    currentUser: {
                        login: userLogin,
                        avatarUrl: currentUserData.avatarUrl,
                    },
                    lineNumber: args.lineNumber,
                    side: args.side,
                    startLineNumber: args.startLineNumber,
                    startSide: args.startSide,
                    pendingReviewId: isReview ? (pendingReviewId ?? 0) : null,
                    authorAssociation,
                });
                if (isReview) {
                    previousPending = utils.reviews.getPending.getData({
                        owner,
                        repo,
                        number: Number(number),
                    });
                    utils.reviews.getPending.setData(
                        { owner, repo, number: Number(number) },
                        (old) => ({
                            reviewId: old?.reviewId ?? 0,
                            comments: [
                                ...(old?.comments ?? []),
                                stub,
                            ] as typeof old extends { comments: infer C }
                                ? C
                                : never,
                        }),
                    );
                } else {
                    utils.reviewComments.list.setData(
                        { owner, repo, number: Number(number) },
                        (old) => (old ? [...old, stub] : old),
                    );
                }
                if (!showComments) recentlyAddedIds.current.add(stub.id);
            }
            const create = () => createMutation.mutate(args);
            const rollback = () => {
                setCommentBody(body);
                setActiveComment(savedActiveComment);
                if (previousPending !== undefined) {
                    utils.reviews.getPending.setData(
                        { owner, repo, number: Number(number) },
                        previousPending,
                    );
                }
            };
            if (isReview && !pendingReviewId) {
                startReviewMutation.mutate(
                    { owner, repo, number: Number(number) },
                    { onSuccess: create, onError: rollback },
                );
            } else create();
        },
        [
            activeComment,
            commentBody,
            createMutation,
            currentUserData,
            filename,
            number,
            owner,
            pendingReviewId,
            recentlyAddedIds,
            repo,
            setActiveComment,
            setCommentBody,
            showComments,
            startReviewMutation,
            utils,
        ],
    );

    const footerActions = pendingReviewId
        ? [
              {
                  label: "Add to Review",
                  onClick: () => handleAddComment(true),
                  variant: "approve" as const,
                  disabled: (text: string) => !text.trim(),
              },
          ]
        : [
              {
                  label: "Add single comment",
                  onClick: () => handleAddComment(false),
                  variant: "neutral" as const,
                  disabled: (text: string) => !text.trim(),
              },
              {
                  label: "Start a Review",
                  onClick: () => handleAddComment(true),
                  variant: "approve" as const,
                  disabled: (text: string) => !text.trim(),
              },
          ];
    return {
        createMutation,
        startReviewMutation,
        footerActions,
        effectiveShowComments:
            showComments || recentlyAddedIds.current.size > 0,
    };
}
