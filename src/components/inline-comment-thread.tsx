"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    canInteract,
    type PullRequestPermissionContext,
} from "~/app/gh/[owner]/[repo]/pull/[number]/permissions-utils";
import {
    ResolveButton,
    ResolvedThreadBanner,
} from "~/components/resolved-thread-banner";
import { ReviewCommentItem } from "~/components/review-comment-item";
import {
    ReplyTextboxButton,
    ReviewCommentReplyComposer,
} from "~/components/review-comment-reply-composer";
import { readAutosave, useAutosave } from "~/hooks/use-autosave";
import { useTogglePullRequestReviewCommentReaction } from "~/hooks/use-reaction-toggle";
import { useReviewCommentEdit } from "~/hooks/use-review-comment-edit";
import { useReviewCommentReply } from "~/hooks/use-review-comment-reply";
import {
    applyReviewThreadOperations,
    useReviewThreadOperations,
} from "~/hooks/use-review-thread-operations";
import type { ReactionContent } from "~/lib/reactions";
import { removeCommentFromFlatList } from "~/lib/review-comment-cache-utils";
import type { ReviewComment } from "~/server/github";
import { api } from "~/trpc/react";

// Cache for preserving in-progress reply state across stub -> real comment
// transitions. When a new comment is posted with optimistic update, the stub
// gets a temporary negative ID. If the user opens the reply textarea and
// starts typing before the server confirms, the cache refetch replaces the
// stub with the real comment (different ID), causing React to unmount the
// old component and mount a new one. This cache bridges that gap by keying
// on stable properties (path, line, side) instead of the volatile comment ID.
const replyStateCache = new Map<string, { body: string; visible: boolean }>();

interface InlineCommentThreadProps {
    parentComment: ReviewComment;
    replies: ReviewComment[];
    owner: string;
    repo: string;
    number: number;
    pendingReviewId?: number | null;
    permissionContext: PullRequestPermissionContext;
}

export function InlineCommentThread({
    parentComment,
    replies,
    owner,
    repo,
    number,
    pendingReviewId,
    permissionContext,
}: InlineCommentThreadProps) {
    const threadIdentity = useMemo(
        () => getThreadIdentity(parentComment),
        [parentComment],
    );

    const savedState = replyStateCache.get(threadIdentity);

    const [showReplyForm, setShowReplyForm] = useState(
        () => savedState?.visible ?? false,
    );
    const replyKey = `pr-autosave:reply:${owner}:${repo}:${number}:${threadIdentity}`;
    const [replyBody, setReplyBody] = useState(
        () => readAutosave(replyKey) ?? savedState?.body ?? "",
    );
    const { clear: clearReply } = useAutosave(replyKey, replyBody);
    const [expandedResolved, setExpandedResolved] = useState(false);
    const {
        editingCommentId,
        editBody,
        savedBodies,
        setEditBody,
        taskToggleMutation,
        cancelEdit,
        startEdit,
        saveEdit,
    } = useReviewCommentEdit({ owner, repo, number });
    const _canInteract = canInteract(permissionContext);

    // Persist reply state so it survives stub -> real remount cycles
    useEffect(() => {
        replyStateCache.set(threadIdentity, {
            body: replyBody,
            visible: showReplyForm,
        });
    }, [threadIdentity, replyBody, showReplyForm]);

    // Track stub status in a ref so the cleanup effect below always
    // reads the latest value without needing parentComment.id as a dep.
    const isStubRef = useRef(parentComment.id < 0);
    isStubRef.current = parentComment.id < 0;

    useEffect(() => {
        return () => {
            if (!isStubRef.current) {
                replyStateCache.delete(threadIdentity);
            }
        };
    }, [threadIdentity]);
    const utils = api.useUtils();

    const { data: currentUserData } = api.users.currentUser.useQuery();
    const currentUserLogin = currentUserData?.login ?? "";

    const allCommentIds = useMemo(
        () => [parentComment.id, ...replies.map((c) => c.id)],
        [parentComment.id, replies],
    );

    const { data: reactionMap = {} } =
        api.reactions.getForReviewComments.useQuery(
            { owner, repo, commentIds: allCommentIds },
            { staleTime: 30_000 },
        );

    const replyMutation = useReviewCommentReply({
        owner,
        repo,
        number,
        parentComment,
        currentUser: currentUserData?.login
            ? {
                  login: currentUserData.login,
                  avatarUrl: currentUserData.avatarUrl,
              }
            : undefined,
        onSuccess: clearReply,
    });

    const reactMutation = useTogglePullRequestReviewCommentReaction(
        owner,
        repo,
        allCommentIds,
        currentUserLogin,
    );

    const handleReply = useCallback(() => {
        if (!replyBody.trim()) return;
        const body = replyBody;
        setReplyBody("");
        setShowReplyForm(false);
        replyMutation.submit(body);
    }, [replyBody, replyMutation]);

    const handleSaveEdit = (commentId: number) => {
        saveEdit(commentId);
    };

    const handleReact = useCallback(
        (commentId: number, content: ReactionContent) => {
            reactMutation.mutate({ owner, repo, commentId, content });
        },
        [reactMutation, owner, repo],
    );

    const deleteMutation = api.reviewComments.delete.useMutation({
        onMutate: async ({ commentId }) => {
            await utils.reviewComments.list.cancel({ owner, repo, number });
            const prevListData = utils.reviewComments.list.getData({
                owner,
                repo,
                number,
            });

            await utils.reviews.getPending.cancel({ owner, repo, number });
            const prevPendingData = utils.reviews.getPending.getData({
                owner,
                repo,
                number,
            });

            utils.reviewComments.list.setData(
                { owner, repo, number },
                (old) => {
                    if (!old) return old;
                    return removeCommentFromFlatList(old, commentId);
                },
            );

            utils.reviews.getPending.setData({ owner, repo, number }, (old) => {
                if (!old) return old;
                return {
                    ...old,
                    comments: removeCommentFromFlatList(
                        old.comments,
                        commentId,
                    ),
                };
            });

            return { prevListData, prevPendingData };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prevListData) {
                utils.reviewComments.list.setData(
                    { owner, repo, number },
                    ctx.prevListData,
                );
            }
            if (ctx?.prevPendingData) {
                utils.reviews.getPending.setData(
                    { owner, repo, number },
                    ctx.prevPendingData,
                );
            }
        },
        onSettled: () => {
            utils.reviewComments.list.invalidate({ owner, repo, number });
            utils.reviews.getPending.invalidate({ owner, repo, number });
        },
    });

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

    const threadInfo = useMemo(() => {
        if (!displayThreads) return null;
        return (
            displayThreads.find((t) =>
                t.comments.some((c) => c.id === parentComment.id),
            ) ?? null
        );
    }, [displayThreads, parentComment.id]);

    const handleResolve = useCallback(() => {
        if (!threadInfo) return;
        setExpandedResolved(false);
        resolveOps.resolve({
            threadId: threadInfo.id,
            resolve: !threadInfo.isResolved,
        });
    }, [threadInfo, resolveOps.resolve]);

    const handleDelete = useCallback(
        (commentId: number) => {
            deleteMutation.mutate({ owner, repo, commentId });
        },
        [deleteMutation, owner, repo],
    );

    // Never render comment bodies while thread resolution state is unknown:
    // resolved threads must not flash open while the threads query loads.
    if (threadsPending) {
        return <div id={`review-thread-${parentComment.id}`} />;
    }

    if (threadInfo?.isResolved && !expandedResolved) {
        return (
            <div className="font-sans" id={`review-thread-${parentComment.id}`}>
                <ResolvedThreadBanner
                    onShow={() => setExpandedResolved(true)}
                />
            </div>
        );
    }

    return (
        <div className="font-sans" id={`review-thread-${parentComment.id}`}>
            <ReviewCommentItem
                owner={owner}
                repo={repo}
                number={number}
                comment={parentComment}
                isPending={
                    pendingReviewId != null &&
                    parentComment.pull_request_review_id === pendingReviewId
                }
                isOutdated={threadInfo?.isOutdated ?? false}
                isEditing={editingCommentId === parentComment.id}
                editBody={editingCommentId === parentComment.id ? editBody : ""}
                displayBody={
                    savedBodies[parentComment.id] ?? parentComment.body
                }
                reactions={reactionMap[parentComment.id] ?? []}
                permissionContext={permissionContext}
                isStub={parentComment.id < 0}
                onStartEdit={() => {
                    startEdit(parentComment.id, parentComment.body);
                }}
                onEditBodyChange={setEditBody}
                onCancelEdit={cancelEdit}
                onSaveEdit={() => handleSaveEdit(parentComment.id)}
                onReact={(content) => handleReact(parentComment.id, content)}
                onDelete={() => handleDelete(parentComment.id)}
                threadId={threadInfo?.id ?? ""}
                placement="parent"
                onToggleTask={(body) => {
                    if (taskToggleMutation.isPending) return;
                    taskToggleMutation.mutate({
                        owner,
                        repo,
                        number,
                        commentId: parentComment.id,
                        body,
                    });
                }}
            />

            {replies.map((comment) => (
                <div
                    className="bg-surface-secondary dark:bg-zinc-950"
                    key={comment.id}
                >
                    <ReviewCommentItem
                        comment={comment}
                        isPending={
                            pendingReviewId != null &&
                            comment.pull_request_review_id === pendingReviewId
                        }
                        isOutdated={threadInfo?.isOutdated ?? false}
                        isEditing={editingCommentId === comment.id}
                        editBody={
                            editingCommentId === comment.id ? editBody : ""
                        }
                        displayBody={savedBodies[comment.id] ?? comment.body}
                        reactions={reactionMap[comment.id] ?? []}
                        permissionContext={permissionContext}
                        isStub={comment.id < 0}
                        onStartEdit={() => {
                            startEdit(comment.id, comment.body);
                        }}
                        onEditBodyChange={setEditBody}
                        onCancelEdit={cancelEdit}
                        onSaveEdit={() => handleSaveEdit(comment.id)}
                        onReact={(content) => handleReact(comment.id, content)}
                        onDelete={() => handleDelete(comment.id)}
                        owner={owner}
                        repo={repo}
                        number={number}
                        threadId={threadInfo?.id ?? ""}
                        placement="reply"
                        onToggleTask={(body) => {
                            if (taskToggleMutation.isPending) return;
                            taskToggleMutation.mutate({
                                owner,
                                repo,
                                number,
                                commentId: comment.id,
                                body,
                            });
                        }}
                    />
                </div>
            ))}

            {_canInteract ? (
                showReplyForm ? (
                    <ReviewCommentReplyComposer
                        value={replyBody}
                        onChange={setReplyBody}
                        onSubmit={handleReply}
                        onCancel={() => {
                            setShowReplyForm(false);
                            setReplyBody("");
                        }}
                        isPending={replyMutation.isPending}
                        isError={replyMutation.isError}
                        owner={owner}
                        repo={repo}
                        placeholder="Write a reply..."
                    />
                ) : (
                    <div className="flex w-full items-center gap-2 px-6 py-2">
                        <div className="min-w-0 flex-1">
                            <ReplyTextboxButton
                                onClick={() => setShowReplyForm(true)}
                            />
                        </div>
                        <ResolveButton
                            onClick={handleResolve}
                            isPending={
                                threadInfo
                                    ? resolveOps.isPending(threadInfo.id)
                                    : false
                            }
                            isUnresolve={threadInfo?.isResolved ?? false}
                        />
                    </div>
                )
            ) : null}
        </div>
    );
}

function getThreadIdentity(comment: ReviewComment): string {
    return [
        comment.path,
        comment.line ?? "F",
        comment.side ?? "N",
        comment.start_line ?? "0",
        comment.start_side ?? "N",
    ].join(":");
}
