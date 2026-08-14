"use client";

import type { components } from "@octokit/openapi-types";
import { ChevronDown } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { CommentCard } from "~/components/comment-card";
import { CommentDeleteDialog } from "~/components/comment-delete-dialog";
import {
    CommentMenu,
    DeleteMenuItem,
    EditMenuItem,
} from "~/components/comment-menu";
import { CommentReactionFooter } from "~/components/comment-reaction-footer";
import {
    CommentReplyForm,
    ThreadReplyBar,
} from "~/components/comment-reply-form";
import { DiffView } from "~/components/diff-view";
import { MarkdownRenderer } from "~/components/markdown/markdown-renderer";
import {
    captureReviewCommentLists,
    invalidateReviewCommentLists,
    removeReviewCommentFromLists,
    restoreReviewCommentLists,
    useReviewCommentEditMutations,
    useReviewCommentReplyMutation,
    useReviewThreads,
} from "~/components/review-comment-mutations";
import {
    cancelTimelineList,
    filterTimelineEvents,
    getTimelineListData,
    invalidateTimelineList,
    restoreTimelineListData,
    timelineListKey,
} from "~/components/timeline-cache";
import { readAutosave, useAutosave } from "~/hooks/use-autosave";
import { useTogglePullRequestReviewCommentReaction } from "~/hooks/use-reaction-toggle";
import { type TaskToggleApi, useTaskToggle } from "~/hooks/use-task-toggle";
import type { ReactionContent } from "~/lib/reactions";
import type { ReviewCommentBase } from "~/server/github";
import { api } from "~/trpc/react";
import {
    canEdit,
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
    const [editingCommentId, setEditingCommentId] = useState<number | null>(
        null,
    );
    const [editBody, setEditBody] = useState("");
    const [savedBodies, setSavedBodies] = useState<Record<number, string>>({});
    const [expandedResolvedIds, setExpandedResolvedIds] = useState<Set<number>>(
        new Set(),
    );
    const utils = api.useUtils();

    const { threadsPending, threadByCommentId, resolveOps } = useReviewThreads({
        owner,
        repo,
        number,
    });

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

    const { updateMutation, taskToggleMutation } =
        useReviewCommentEditMutations({ setSavedBodies, setEditingCommentId });

    const deleteMutation = api.reviewComments.delete.useMutation({
        onMutate: async ({ commentId }) => {
            const captured = await captureReviewCommentLists(utils, {
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

            const timelineKey = timelineListKey({ owner, repo, number });
            await cancelTimelineList(utils, timelineKey);
            const prevTimelineData = getTimelineListData(utils, timelineKey);

            removeReviewCommentFromLists(
                utils,
                { owner, repo, number },
                commentId,
            );

            if (removesLastReviewComment) {
                filterTimelineEvents(
                    utils,
                    timelineKey,
                    (event) =>
                        event.__typename !== "PullRequestReview" ||
                        event.databaseId !== reviewId,
                );
            }

            return { ...captured, prevTimelineData };
        },
        onError: (_err, _vars, ctx) => {
            restoreReviewCommentLists(utils, { owner, repo, number }, ctx);
            restoreTimelineListData(
                utils,
                timelineListKey({ owner, repo, number }),
                ctx?.prevTimelineData,
            );
        },
        onSettled: () => {
            invalidateReviewCommentLists(utils, { owner, repo, number });
            invalidateTimelineList(
                utils,
                timelineListKey({ owner, repo, number }),
            );
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

    const handleSaveEdit = (commentId: number) => {
        if (!editBody.trim()) return;
        updateMutation.mutate({
            owner,
            repo,
            number,
            commentId,
            body: editBody,
        });
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
                                onStartEdit={(id, body) => {
                                    setEditBody(body);
                                    setEditingCommentId(id);
                                }}
                                onEditBodyChange={setEditBody}
                                onCancelEdit={() => {
                                    setEditingCommentId(null);
                                    setEditBody("");
                                }}
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
    const [menuOpenCommentId, setMenuOpenCommentId] = useState<number | null>(
        null,
    );
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    // TODO: I think we dont need to load this until a reply happens
    const { data: currentUserData } = api.users.currentUser.useQuery();
    const { onToggleTask: onToggleParentTask } = useTaskToggle({
        mutation: toggleMutation,
        staticInput: { owner, repo, commentId: comment.id },
    });

    const replyMutation = useReviewCommentReplyMutation({
        owner,
        repo,
        number,
        anchor: comment,
        currentUser: currentUserData,
        onStart: () => {
            setReplyBody("");
            setShowReplyForm(false);
        },
        onSuccess: clearReply,
    });
    if (!comment.user) {
        return null;
    }
    if (isResolved && !isExpanded) {
        return <div id={`review-thread-${comment.id}`} />;
    }

    const parentReactions = reactionMap[comment.id] ?? [];
    const _canInteract = canInteract(permissionContext);
    const _canEdit = canEdit(permissionContext);

    return (
        <>
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
                <CommentCard
                    user={comment.user}
                    userHref={comment.user?.html_url}
                    createdAt={comment.created_at}
                    authorAssociation={comment.author_association}
                    isPending={state === "pending"}
                    owner={owner}
                    repo={repo}
                    isEditing={editingCommentId === comment.id}
                    editBody={editingCommentId === comment.id ? editBody : ""}
                    onEditBodyChange={onEditBodyChange}
                    onCancelEdit={onCancelEdit}
                    onSaveEdit={() => onSaveEdit(comment.id)}
                    headerActions={
                        _canInteract && (
                            <CommentMenu
                                open={menuOpenCommentId === comment.id}
                                onOpenChange={(open) =>
                                    setMenuOpenCommentId(
                                        open ? comment.id : null,
                                    )
                                }
                            >
                                {(comment.user?.login ===
                                    permissionContext.currentUser ||
                                    _canEdit) && (
                                    <EditMenuItem
                                        onClick={() =>
                                            onStartEdit(
                                                comment.id,
                                                savedBodies[comment.id] ??
                                                    comment.body,
                                            )
                                        }
                                        onClose={() =>
                                            setMenuOpenCommentId(null)
                                        }
                                    />
                                )}
                                <DeleteMenuItem
                                    onClick={() =>
                                        setDeleteConfirmId(comment.id)
                                    }
                                    onClose={() => setMenuOpenCommentId(null)}
                                />
                            </CommentMenu>
                        )
                    }
                    footer={
                        _canInteract && (
                            <CommentReactionFooter
                                reactions={parentReactions}
                                currentUserLogin={permissionContext.currentUser}
                                onReact={(content) =>
                                    onReact(comment.id, content)
                                }
                                className="mx-6 flex flex-wrap items-center gap-1.5 px-4 pb-3"
                            />
                        )
                    }
                >
                    <MarkdownRenderer
                        content={savedBodies[comment.id] ?? comment.body}
                        owner={owner}
                        repo={repo}
                        pullNumber={number}
                        commentPath={comment.path}
                        commentLine={comment.line}
                        commentStartLine={comment.start_line}
                        commentThreadId={threadId}
                        onToggleTask={onToggleParentTask}
                        canToggleTasks={
                            (comment.user?.login ===
                                permissionContext.currentUser ||
                                _canEdit) &&
                            _canInteract
                        }
                    />
                </CommentCard>
                {replies.map((reply) => {
                    if (!reply.user) return null;
                    const replyReactions = reactionMap[reply.id] ?? [];
                    return (
                        <div key={reply.id} className="mt-2 pl-3">
                            <CommentCard
                                user={reply.user}
                                userHref={reply.user?.html_url}
                                createdAt={reply.created_at}
                                authorAssociation={reply.author_association}
                                owner={owner}
                                repo={repo}
                                variant="nested"
                                isEditing={editingCommentId === reply.id}
                                editBody={
                                    editingCommentId === reply.id
                                        ? editBody
                                        : ""
                                }
                                onEditBodyChange={onEditBodyChange}
                                onCancelEdit={onCancelEdit}
                                onSaveEdit={() => onSaveEdit(reply.id)}
                                headerActions={
                                    _canInteract && (
                                        <CommentMenu
                                            open={
                                                menuOpenCommentId === reply.id
                                            }
                                            onOpenChange={(open) =>
                                                setMenuOpenCommentId(
                                                    open ? reply.id : null,
                                                )
                                            }
                                        >
                                            {(reply.user?.login ===
                                                permissionContext.currentUser ||
                                                _canEdit) && (
                                                <EditMenuItem
                                                    onClick={() =>
                                                        onStartEdit(
                                                            reply.id,
                                                            savedBodies[
                                                                reply.id
                                                            ] ?? reply.body,
                                                        )
                                                    }
                                                    onClose={() =>
                                                        setMenuOpenCommentId(
                                                            null,
                                                        )
                                                    }
                                                />
                                            )}
                                            <DeleteMenuItem
                                                onClick={() =>
                                                    setDeleteConfirmId(reply.id)
                                                }
                                                onClose={() =>
                                                    setMenuOpenCommentId(null)
                                                }
                                            />
                                        </CommentMenu>
                                    )
                                }
                                footer={
                                    _canInteract && (
                                        <CommentReactionFooter
                                            reactions={replyReactions}
                                            currentUserLogin={
                                                permissionContext.currentUser
                                            }
                                            onReact={(content) =>
                                                onReact(reply.id, content)
                                            }
                                            className="mx-6 flex flex-wrap items-center gap-1.5 px-4 pb-3"
                                        />
                                    )
                                }
                            >
                                <MarkdownRenderer
                                    content={
                                        savedBodies[reply.id] ?? reply.body
                                    }
                                    owner={owner}
                                    repo={repo}
                                    pullNumber={number}
                                    commentPath={comment.path}
                                    commentLine={comment.line}
                                    commentStartLine={comment.start_line}
                                    commentThreadId={threadId}
                                    onToggleTask={(body) => {
                                        if (toggleMutation.isPending) return;
                                        toggleMutation.mutate({
                                            owner,
                                            repo,
                                            commentId: reply.id,
                                            body,
                                        });
                                    }}
                                    canToggleTasks={
                                        (reply.user?.login ===
                                            permissionContext.currentUser ||
                                            _canEdit) &&
                                        _canInteract
                                    }
                                />
                            </CommentCard>
                        </div>
                    );
                })}
                {_canInteract ? (
                    showReplyForm ? (
                        <div className="p-2">
                            <CommentReplyForm
                                value={replyBody}
                                onChange={setReplyBody}
                                onCancel={() => {
                                    setShowReplyForm(false);
                                    setReplyBody("");
                                }}
                                onSubmit={() => {
                                    if (!replyBody.trim()) return;
                                    replyMutation.mutate({
                                        owner,
                                        repo,
                                        number,
                                        body: replyBody,
                                        inReplyTo: comment.id,
                                    });
                                }}
                                isPending={replyMutation.isPending}
                                isError={replyMutation.isError}
                                owner={owner}
                                repo={repo}
                            />
                        </div>
                    ) : (
                        <ThreadReplyBar
                            onReply={() => setShowReplyForm(true)}
                            onResolve={() =>
                                onResolve(comment.id, threadId, !isResolved)
                            }
                            resolvePending={isResolvePending(threadId)}
                            isUnresolve={isResolved}
                        />
                    )
                ) : null}
            </div>
            <CommentDeleteDialog
                open={deleteConfirmId !== null}
                onOpenChange={(open) => {
                    if (!open) setDeleteConfirmId(null);
                }}
                onConfirm={() => {
                    if (deleteConfirmId !== null) {
                        onDelete(deleteConfirmId);
                    }
                }}
            />
        </>
    );
}
