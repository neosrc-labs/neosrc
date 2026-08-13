"use client";

import type { components } from "@octokit/openapi-types";
import { MoreVertical, SquarePen, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommentCard } from "~/components/comment-card";
import {
    ResolveButton,
    ResolvedThreadBanner,
} from "~/components/resolved-thread-banner";

type Reaction = components["schemas"]["reaction"];

import {
    canEdit,
    canInteract,
    type PullRequestPermissionContext,
} from "~/app/gh/[owner]/[repo]/pull/[number]/permissions-utils";
import { ReactionBar } from "~/components/reaction-bar";
import { ReactionPicker } from "~/components/reaction-picker";
import { Button } from "~/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import { readAutosave, useAutosave } from "~/hooks/use-autosave";
import { useTogglePullRequestReviewCommentReaction } from "~/hooks/use-reaction-toggle";
import {
    applyReviewThreadOperations,
    useReviewThreadOperations,
} from "~/hooks/use-review-thread-operations";
import { type TaskToggleApi, useTaskToggle } from "~/hooks/use-task-toggle";
import type { ReactionContent } from "~/lib/reactions";
import { removeCommentFromFlatList } from "~/lib/review-comment-cache-utils";
import type { ReviewComment } from "~/server/github";
import { api } from "~/trpc/react";
import { MarkdownEditor } from "./markdown/markdown-editor";
import { MarkdownRenderer } from "./markdown/markdown-renderer";
import {
    createReviewCommentStub,
    findAuthorAssociation,
} from "./review-comment-utils";

// Cache for preserving in-progress reply state across stub -> real comment
// transitions. When a new comment is posted with optimistic update, the stub
// gets a temporary negative ID. If the user opens the reply textarea and
// starts typing before the server confirms, the cache refetch replaces the
// stub with the real comment (different ID), causing React to unmount the
// old component and mount a new one. This cache bridges that gap by keying
// on stable properties (path, line, side) instead of the volatile comment ID.
const replyStateCache = new Map<string, { body: string; visible: boolean }>();

function getThreadIdentity(comment: ReviewComment): string {
    return [
        comment.path,
        comment.line ?? "F",
        comment.side ?? "N",
        comment.start_line ?? "0",
        comment.start_side ?? "N",
    ].join(":");
}

interface InlineCommentThreadProps {
    parentComment: ReviewComment;
    replies: ReviewComment[];
    owner: string;
    repo: string;
    number: number;
    pendingReviewId?: number | null;
    permissionContext: PullRequestPermissionContext;
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: FIXME: split this up
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
    const [editingCommentId, setEditingCommentId] = useState<number | null>(
        null,
    );
    const [editBody, setEditBody] = useState("");
    const [savedBodies, setSavedBodies] = useState<Record<number, string>>({});
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

    const replyMutation = api.reviewComments.reply.useMutation({
        onMutate: async ({ body, inReplyTo }) => {
            setReplyBody("");
            setShowReplyForm(false);

            await utils.reviewComments.list.cancel({
                owner,
                repo,
                number,
            });
            const prevData = utils.reviewComments.list.getData({
                owner,
                repo,
                number,
            });

            const userLogin = currentUserData?.login;
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
                    filePath: parentComment.path,
                    currentUser: {
                        login: userLogin,
                        avatarUrl: currentUserData.avatarUrl,
                    },
                    lineNumber: parentComment.line,
                    side: parentComment.side,
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
            clearReply();
        },
        onSettled: () => {
            utils.reviewComments.list.invalidate({
                owner,
                repo,
                number,
            });
        },
    });

    const updateMutation = api.reviewComments.update.useMutation({
        onMutate: ({ commentId, body }) => {
            setSavedBodies((prev) => ({ ...prev, [commentId]: body }));
            setEditingCommentId(null);
        },
        onError: (_, { commentId }) => {
            setSavedBodies((prev) => {
                const next = { ...prev };
                delete next[commentId];
                return next;
            });
            setEditingCommentId(commentId);
        },
    });
    const taskToggleMutation = api.reviewComments.update.useMutation({
        onMutate: ({ commentId, body }) => {
            setSavedBodies((prev) => ({ ...prev, [commentId]: body }));
        },
        onError: (_, { commentId }) => {
            setSavedBodies((prev) => {
                const next = { ...prev };
                delete next[commentId];
                return next;
            });
        },
    });

    const reactMutation = useTogglePullRequestReviewCommentReaction(
        owner,
        repo,
        allCommentIds,
        currentUserLogin,
    );

    const handleReply = useCallback(() => {
        if (!replyBody.trim()) return;
        replyMutation.mutate({
            owner,
            repo,
            number,
            body: replyBody,
            inReplyTo: parentComment.id,
        });
    }, [replyBody, parentComment.id, replyMutation, owner, repo, number]);

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
            <Comment
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
                    setEditBody(parentComment.body);
                    setEditingCommentId(parentComment.id);
                }}
                onEditBodyChange={setEditBody}
                onCancelEdit={() => {
                    setEditingCommentId(null);
                    setEditBody("");
                }}
                onSaveEdit={() => handleSaveEdit(parentComment.id)}
                onReact={(content) => handleReact(parentComment.id, content)}
                onDelete={() => handleDelete(parentComment.id)}
                threadId={threadInfo?.id ?? ""}
                variant="parent"
                toggleMutation={{
                    mutate: taskToggleMutation.mutate,
                    isPending: taskToggleMutation.isPending,
                }}
            />

            {replies.map((comment) => (
                <div
                    className="bg-surface-secondary dark:bg-zinc-950"
                    key={comment.id}
                >
                    <Comment
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
                            setEditBody(comment.body);
                            setEditingCommentId(comment.id);
                        }}
                        onEditBodyChange={setEditBody}
                        onCancelEdit={() => {
                            setEditingCommentId(null);
                            setEditBody("");
                        }}
                        onSaveEdit={() => handleSaveEdit(comment.id)}
                        onReact={(content) => handleReact(comment.id, content)}
                        onDelete={() => handleDelete(comment.id)}
                        owner={owner}
                        repo={repo}
                        number={number}
                        threadId={threadInfo?.id ?? ""}
                        variant="reply"
                        toggleMutation={{
                            mutate: taskToggleMutation.mutate,
                            isPending: taskToggleMutation.isPending,
                        }}
                    />
                </div>
            ))}
            {_canInteract ? (
                showReplyForm ? (
                    <div className="p-2">
                        <MarkdownEditor
                            autoFocus
                            disabled={replyMutation.isPending}
                            onChange={setReplyBody}
                            onCancel={() => {
                                setShowReplyForm(false);
                                setReplyBody("");
                            }}
                            placeholder="Write a reply..."
                            value={replyBody}
                            owner={owner}
                            repo={repo}
                            footerActions={[
                                {
                                    label: "Reply",
                                    onClick: () => handleReply(),
                                    variant: "approve",
                                    disabled: (text: string) => !text.trim(),
                                },
                            ]}
                        />
                        {replyMutation.isError && (
                            <p className="mt-1 text-red-600 text-xs">
                                Failed to post reply. Please try again.
                            </p>
                        )}
                    </div>
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

function Comment({
    comment,
    isPending,
    isOutdated,
    isEditing,
    editBody,
    displayBody,
    reactions,
    permissionContext,
    isStub,
    onStartEdit,
    onEditBodyChange,
    onCancelEdit,
    onSaveEdit,
    onReact,
    onDelete,
    owner,
    repo,
    number,
    threadId,
    variant,
    toggleMutation,
}: {
    comment: ReviewComment;
    isPending: boolean;
    isOutdated: boolean;
    isEditing: boolean;
    editBody: string;
    displayBody: string;
    reactions: Reaction[];
    permissionContext: PullRequestPermissionContext;
    isStub: boolean;
    onStartEdit: () => void;
    onEditBodyChange: (body: string) => void;
    onCancelEdit: () => void;
    onSaveEdit: () => void;
    onReact: (content: ReactionContent) => void;
    onDelete: () => void;
    owner: string;
    repo: string;
    number: number;
    threadId: string;
    variant: "parent" | "reply";
    toggleMutation: TaskToggleApi<{
        owner: string;
        repo: string;
        commentId: number;
        body: string;
    }>;
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const { onToggleTask } = useTaskToggle({
        mutation: toggleMutation,
        staticInput: { owner, repo, commentId: comment.id },
    });

    const _canInteract = canInteract(permissionContext);
    const _canEdit = canEdit(permissionContext);
    const isAuthor = permissionContext.currentUser === comment.user.login;

    return (
        <>
            <CommentCard
                owner={owner}
                repo={repo}
                user={comment.user}
                userHref={comment.user?.html_url}
                createdAt={comment.created_at}
                authorAssociation={comment.author_association}
                isPending={isPending}
                isOutdated={isOutdated}
                isEditing={isEditing}
                editBody={editBody}
                onEditBodyChange={onEditBodyChange}
                onCancelEdit={onCancelEdit}
                onSaveEdit={onSaveEdit}
                variant={variant === "parent" ? "default" : "nested"}
                headerActions={
                    <>
                        {(isAuthor || _canEdit) && _canInteract && !isStub && (
                            <button
                                type="button"
                                aria-label="Edit comment"
                                className="cursor-pointer rounded p-1 text-text-muted transition-colors hover:bg-surface-tertiary hover:text-text-secondary dark:hover:text-zinc-300"
                                onClick={onStartEdit}
                            >
                                <SquarePen size={14} />
                            </button>
                        )}
                        {_canInteract && !isStub && (
                            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                                <PopoverTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label="More options"
                                        className="cursor-pointer rounded p-1 text-text-muted transition-colors hover:bg-surface-tertiary hover:text-text-secondary dark:hover:text-zinc-300"
                                    >
                                        <MoreVertical size={14} />
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-44 bg-surface p-1"
                                    align="end"
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMenuOpen(false);
                                            setDeleteConfirmOpen(true);
                                        }}
                                        className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-text-label transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                                    >
                                        <Trash2 size={14} />
                                        Delete comment
                                    </button>
                                </PopoverContent>
                            </Popover>
                        )}
                        {isStub && (
                            <span className="inline-flex animate-pulse items-center rounded p-1 font-medium text-text-muted text-xs">
                                Saving...
                            </span>
                        )}
                    </>
                }
                footer={
                    <div className="mx-6 flex flex-wrap items-center gap-1.5 px-4 pb-3">
                        {_canInteract && (
                            <>
                                <ReactionPicker
                                    disabled={isStub}
                                    reactions={reactions}
                                    currentUserLogin={
                                        permissionContext.currentUser
                                    }
                                    onReact={onReact}
                                />
                                <ReactionBar
                                    disabled={isStub}
                                    reactions={reactions}
                                    currentUserLogin={
                                        permissionContext.currentUser
                                    }
                                    onReact={onReact}
                                />
                            </>
                        )}
                    </div>
                }
            >
                <MarkdownRenderer
                    content={displayBody}
                    owner={owner}
                    repo={repo}
                    pullNumber={number}
                    commentPath={comment.path}
                    commentLine={comment.line}
                    commentStartLine={comment.start_line}
                    commentThreadId={threadId}
                    onToggleTask={onToggleTask}
                    canToggleTasks={
                        (isAuthor || _canEdit) && _canInteract && !isStub
                    }
                />
            </CommentCard>
            <Dialog
                open={deleteConfirmOpen}
                onOpenChange={setDeleteConfirmOpen}
            >
                <DialogContent showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle>Delete comment</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this comment? This
                            action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteConfirmOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                onDelete();
                                setDeleteConfirmOpen(false);
                            }}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export function ReplyTextboxButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            className="flex w-full cursor-text items-center rounded-md border border-gray-200 bg-surface-elevated px-3 py-1.5 text-text-muted text-xs transition-colors duration-200 hover:border-gray-400 dark:border-zinc-600 dark:hover:border-zinc-400"
            onClick={onClick}
        >
            Reply...
        </button>
    );
}
