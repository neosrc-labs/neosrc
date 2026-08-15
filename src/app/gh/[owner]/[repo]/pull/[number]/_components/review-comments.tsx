"use client";

import type { components } from "@octokit/openapi-types";
import { ChevronDown } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { DiffView } from "~/components/diff-view";
import { ResolveButton } from "~/components/resolved-thread-banner";
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
import { type TaskToggleApi, useTaskToggle } from "~/hooks/use-task-toggle";
import type { ReactionContent } from "~/lib/reactions";
import { removeCommentFromFlatList } from "~/lib/review-comment-cache-utils";
import { TIMELINE_PAGE_SIZE } from "~/lib/timeline-constants";
import type { ReviewCommentBase } from "~/server/github";
import { api } from "~/trpc/react";
import {
    canInteract,
    type PullRequestPermissionContext,
} from "../permissions-utils";

type Reaction = components["schemas"]["reaction"];

interface ReviewCommentsProps {
    owner: string;
    repo: string;
    number: number;
    reviewId: number;
    hasReviewBody: boolean;
    state?: string;
    allComments: ReviewCommentBase[];
    permissionContext: PullRequestPermissionContext;
}

export function ReviewComments({
    owner,
    repo,
    number,
    reviewId,
    hasReviewBody,
    state,
    allComments,
    permissionContext,
}: ReviewCommentsProps) {
    const {
        editingCommentId,
        editBody,
        savedBodies,
        setEditBody,
        taskToggleMutation,
        startEdit,
        cancelEdit,
        saveEdit,
    } = useReviewCommentEdit({ owner, repo, number });
    const [expandedResolvedIds, setExpandedResolvedIds] = useState<Set<number>>(
        new Set(),
    );
    const utils = api.useUtils();

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

    const handleResolve = useCallback(
        (commentId: number, threadId: string, resolve: boolean) => {
            setExpandedResolvedIds((prev) => {
                const next = new Set(prev);
                next.delete(commentId);
                return next;
            });
            resolveOps.resolve({
                threadId,
                resolve,
            });
        },
        [resolveOps.resolve],
    );

    const allCommentIds = useMemo(() => {
        const topLevelIds = new Set<number>();
        const ids: number[] = [];
        for (const c of allComments) {
            if (!c.in_reply_to_id && c.pull_request_review_id === reviewId) {
                topLevelIds.add(c.id);
                ids.push(c.id);
            }
        }
        for (const c of allComments) {
            if (c.in_reply_to_id && topLevelIds.has(c.in_reply_to_id)) {
                ids.push(c.id);
            }
        }
        return ids;
    }, [allComments, reviewId]);

    const { data: reactionMap = {} } =
        api.reactions.getForReviewComments.useQuery(
            { owner, repo, commentIds: allCommentIds },
            { enabled: allCommentIds.length > 0, staleTime: 30_000 },
        );

    const handleSaveEdit = (commentId: number) => {
        saveEdit(commentId);
    };

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

            const removesLastReviewComment =
                !hasReviewBody &&
                !allComments.some(
                    (comment) =>
                        comment.pull_request_review_id === reviewId &&
                        comment.id !== commentId,
                );

            await utils.timeline.list.cancel({
                owner,
                repo,
                number,
                limit: TIMELINE_PAGE_SIZE,
            });
            const prevTimelineData = utils.timeline.list.getInfiniteData({
                owner,
                repo,
                number,
                limit: TIMELINE_PAGE_SIZE,
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

            if (removesLastReviewComment) {
                utils.timeline.list.setInfiniteData(
                    { owner, repo, number, limit: TIMELINE_PAGE_SIZE },
                    (old) => {
                        if (!old) return old;
                        return {
                            ...old,
                            pages: old.pages.map((page) => ({
                                ...page,
                                events: page.events.filter(
                                    (event) =>
                                        event.__typename !==
                                            "PullRequestReview" ||
                                        event.databaseId !== reviewId,
                                ),
                            })),
                        };
                    },
                );
            }

            return { prevListData, prevPendingData, prevTimelineData };
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
            if (ctx?.prevTimelineData) {
                utils.timeline.list.setInfiniteData(
                    { owner, repo, number, limit: TIMELINE_PAGE_SIZE },
                    ctx.prevTimelineData,
                );
            }
        },
        onSettled: () => {
            utils.reviewComments.list.invalidate({ owner, repo, number });
            utils.reviews.getPending.invalidate({ owner, repo, number });
            utils.timeline.list.invalidate({
                owner,
                repo,
                number,
                limit: TIMELINE_PAGE_SIZE,
            });
        },
    });

    const reactMutation = useTogglePullRequestReviewCommentReaction(
        owner,
        repo,
        allCommentIds,
        permissionContext.currentUser ?? "",
    );

    const handleReact = (commentId: number, content: ReactionContent) => {
        reactMutation.mutate({ owner, repo, commentId, content });
    };

    const handleDelete = (commentId: number) => {
        deleteMutation.mutate({ owner, repo, commentId });
    };

    const replyMap = useMemo(() => {
        const map = new Map<number, ReviewCommentBase[]>();
        for (const comment of allComments) {
            if (comment.in_reply_to_id) {
                const existing = map.get(comment.in_reply_to_id) ?? [];
                existing.push(comment);
                map.set(comment.in_reply_to_id, existing);
            }
        }
        return map;
    }, [allComments]);

    if (allComments.length === 0) {
        return null;
    }

    const topLevel = allComments.filter(
        (c) => !c.in_reply_to_id && c.pull_request_review_id === reviewId,
    );

    if (topLevel.length === 0) {
        return null;
    }

    // Never render comment bodies while thread resolution state is unknown:
    // resolved threads must not flash open while the threads query loads.
    if (threadsPending) {
        return null;
    }

    return (
        <div className="pt-1">
            {topLevel.map((comment) => {
                const thread = threadByCommentId.get(comment.id);
                const isResolved = thread?.isResolved ?? false;
                const isExpanded = expandedResolvedIds.has(comment.id);
                const toggleExpanded = () =>
                    setExpandedResolvedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(comment.id)) {
                            next.delete(comment.id);
                        } else {
                            next.add(comment.id);
                        }
                        return next;
                    });

                return (
                    <div
                        key={comment.id}
                        data-testid="review-thread-block"
                        className="mt-3 rounded border border-border"
                    >
                        <div className="flex items-center gap-2 rounded-t border-border border-b bg-surface-secondary px-4 py-2">
                            <span className="flex-1 truncate font-mono text-text-label text-xs">
                                {comment.path}
                            </span>
                            {isResolved && (
                                <span className="font-sans text-text-tertiary text-xs">
                                    Resolved
                                </span>
                            )}
                            <div className="flex items-center gap-2">
                                {thread?.isOutdated && (
                                    <span className="whitespace-nowrap rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-[10px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                        Outdated
                                    </span>
                                )}
                                {isResolved && (
                                    <button
                                        type="button"
                                        aria-expanded={isExpanded}
                                        onClick={toggleExpanded}
                                        className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-text-tertiary text-xs transition-colors hover:bg-surface-selected hover:text-text-label dark:hover:text-zinc-300"
                                    >
                                        <ChevronDown
                                            size={14}
                                            className={
                                                isExpanded ? "rotate-180" : ""
                                            }
                                        />
                                        Show thread
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="divide-y divide-gray-200 overflow-hidden rounded-b dark:divide-zinc-700">
                            <CommentBlock
                                comment={comment}
                                replies={replyMap.get(comment.id) ?? []}
                                owner={owner}
                                repo={repo}
                                number={number}
                                state={state}
                                permissionContext={permissionContext}
                                reactionMap={reactionMap}
                                editingCommentId={editingCommentId}
                                editBody={editBody}
                                savedBodies={savedBodies}
                                isResolved={isResolved}
                                isExpanded={isExpanded}
                                threadId={thread?.id ?? ""}
                                isResolvePending={resolveOps.isPending}
                                onStartEdit={startEdit}
                                onEditBodyChange={setEditBody}
                                onCancelEdit={cancelEdit}
                                onSaveEdit={handleSaveEdit}
                                onDelete={handleDelete}
                                onReact={handleReact}
                                onResolve={handleResolve}
                                toggleMutation={{
                                    mutate: taskToggleMutation.mutate,
                                    isPending: taskToggleMutation.isPending,
                                }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function truncateDiffToRange(
    diffHunk: string,
    startLine: number | null | undefined,
    endLine: number | null | undefined,
): string {
    if (!startLine || !endLine || startLine >= endLine) return diffHunk;
    const lines = diffHunk.split("\n");
    const headerLine = lines[0];
    if (!headerLine?.startsWith("@@")) return diffHunk;

    const match = headerLine.match(
        /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/,
    );
    if (!match) return diffHunk;

    const newStart = parseInt(match[3] ?? "0", 10);
    let newLine = newStart;
    let oldLine = parseInt(match[1] ?? "0", 10);
    const filtered: string[] = [];
    let newOldLine = 0;
    let newNewCount = 0;
    let newOldCount = 0;
    let started = false;

    for (let i = 1; i < lines.length; i++) {
        const ln = lines[i];
        if (ln === undefined) continue;
        const first = ln[0] ?? "";

        if (first === " ") {
            if (newLine >= startLine && newLine <= endLine) {
                filtered.push(ln);
                if (!started) {
                    started = true;
                    newOldLine = oldLine;
                }
                newOldCount++;
                newNewCount++;
            }
            oldLine++;
            newLine++;
        } else if (first === "-") {
            if (newLine >= startLine && newLine <= endLine) {
                filtered.push(ln);
                if (!started) {
                    started = true;
                    newOldLine = oldLine;
                }
                newOldCount++;
            }
            oldLine++;
        } else if (first === "+") {
            if (newLine >= startLine && newLine <= endLine) {
                filtered.push(ln);
                if (!started) {
                    started = true;
                    newOldLine = oldLine;
                }
                newNewCount++;
            }
            newLine++;
        } else if (first === "\\") {
            if (filtered.length > 0) filtered.push(ln);
        }
    }

    if (filtered.length === 0) return diffHunk;
    if (!started) return diffHunk;

    newOldLine = Math.max(1, newOldLine);
    const newHeader = `@@ -${newOldLine},${newOldCount} +${startLine},${newNewCount} @@`;
    return [newHeader, ...filtered].join("\n");
}

function CommentBlock({
    comment,
    replies,
    owner,
    repo,
    number,
    state,
    permissionContext,
    reactionMap,
    editingCommentId,
    editBody,
    savedBodies,
    isResolved,
    isExpanded,
    threadId,
    isResolvePending,
    onStartEdit,
    onEditBodyChange,
    onCancelEdit,
    onSaveEdit,
    onDelete,
    onReact,
    onResolve,
    toggleMutation,
}: {
    owner: string;
    repo: string;
    number: number;
    comment: ReviewCommentBase;
    replies: ReviewCommentBase[];
    state?: string;
    permissionContext: PullRequestPermissionContext;
    reactionMap: Record<number, Reaction[]>;
    editingCommentId: number | null;
    editBody: string;
    savedBodies: Record<number, string>;
    isResolved: boolean;
    isExpanded: boolean;
    threadId: string;
    isResolvePending: (threadId: string) => boolean;
    onStartEdit: (commentId: number, body: string) => void;
    onEditBodyChange: (body: string) => void;
    onCancelEdit: () => void;
    onSaveEdit: (commentId: number) => void;
    onDelete: (commentId: number) => void;
    onReact: (commentId: number, content: ReactionContent) => void;
    onResolve: (commentId: number, threadId: string, resolve: boolean) => void;
    toggleMutation: TaskToggleApi<{
        owner: string;
        repo: string;
        commentId: number;
        body: string;
    }>;
}) {
    const [showReplyForm, setShowReplyForm] = useState(false);
    const replyKey = `pr-autosave:review-reply:${owner}:${repo}:${number}:${comment.id}`;
    const [replyBody, setReplyBody] = useState(
        () => readAutosave(replyKey) ?? "",
    );
    const { clear: clearReply } = useAutosave(replyKey, replyBody);
    const { data: currentUserData } = api.users.currentUser.useQuery();
    const { onToggleTask: onToggleParentTask } = useTaskToggle({
        mutation: toggleMutation,
        staticInput: { owner, repo, commentId: comment.id },
    });
    const replyMutation = useReviewCommentReply({
        owner,
        repo,
        number,
        parentComment: comment,
        currentUser: currentUserData?.login
            ? {
                  login: currentUserData.login,
                  avatarUrl: currentUserData.avatarUrl,
              }
            : undefined,
        onSuccess: clearReply,
    });
    const allowedToInteract = canInteract(permissionContext);

    if (isResolved && !isExpanded) {
        return <div id={`review-thread-${comment.id}`} />;
    }

    const submitReply = () => {
        if (!replyBody.trim()) return;
        const body = replyBody;
        setReplyBody("");
        setShowReplyForm(false);
        replyMutation.submit(body);
    };

    return (
        <div
            id={`review-thread-${comment.id}`}
            className="bg-surface-secondary dark:bg-zinc-950"
        >
            {comment.diff_hunk && (
                <div>
                    <DiffView
                        patch={truncateDiffToRange(
                            comment.diff_hunk,
                            comment.start_line ??
                                (comment.line != null
                                    ? Math.max(1, comment.line - 5)
                                    : null),
                            comment.line,
                        )}
                        filename={comment.path}
                        permissionContext={permissionContext}
                    />
                </div>
            )}
            <ReviewCommentItem
                comment={comment}
                placement="parent"
                threadId={threadId}
                displayBody={savedBodies[comment.id] ?? comment.body}
                reactions={reactionMap[comment.id] ?? []}
                permissionContext={permissionContext}
                owner={owner}
                repo={repo}
                number={number}
                isPending={state === "pending"}
                isOutdated={false}
                isStub={comment.id < 0}
                isEditing={editingCommentId === comment.id}
                editBody={editingCommentId === comment.id ? editBody : ""}
                onStartEdit={() => onStartEdit(comment.id, comment.body)}
                onEditBodyChange={onEditBodyChange}
                onCancelEdit={onCancelEdit}
                onSaveEdit={() => onSaveEdit(comment.id)}
                onReact={(content) => onReact(comment.id, content)}
                onDelete={() => onDelete(comment.id)}
                onToggleTask={onToggleParentTask}
            />
            {replies.map((reply) => (
                <div
                    key={reply.id}
                    className="bg-surface-secondary dark:bg-zinc-950"
                >
                    <ReviewCommentItem
                        comment={reply}
                        placement="reply"
                        threadId={threadId}
                        displayBody={savedBodies[reply.id] ?? reply.body}
                        reactions={reactionMap[reply.id] ?? []}
                        permissionContext={permissionContext}
                        owner={owner}
                        repo={repo}
                        number={number}
                        isPending={false}
                        isOutdated={false}
                        isStub={reply.id < 0}
                        isEditing={editingCommentId === reply.id}
                        editBody={editingCommentId === reply.id ? editBody : ""}
                        onStartEdit={() => onStartEdit(reply.id, reply.body)}
                        onEditBodyChange={onEditBodyChange}
                        onCancelEdit={onCancelEdit}
                        onSaveEdit={() => onSaveEdit(reply.id)}
                        onReact={(content) => onReact(reply.id, content)}
                        onDelete={() => onDelete(reply.id)}
                        onToggleTask={(body) => {
                            if (toggleMutation.isPending) return;
                            toggleMutation.mutate({
                                owner,
                                repo,
                                commentId: reply.id,
                                body,
                            });
                        }}
                    />
                </div>
            ))}
            {allowedToInteract ? (
                showReplyForm ? (
                    <ReviewCommentReplyComposer
                        value={replyBody}
                        onChange={setReplyBody}
                        onSubmit={submitReply}
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
                            onClick={() =>
                                onResolve(comment.id, threadId, !isResolved)
                            }
                            isPending={isResolvePending(threadId)}
                            isUnresolve={isResolved}
                        />
                    </div>
                )
            ) : null}
        </div>
    );
}
