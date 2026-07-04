"use client";

import type { components } from "@octokit/openapi-types";
import { MoreVertical, SquarePen, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { CommentCard } from "~/components/CommentCard";
import {
    ResolveButton,
    ResolvedThreadBanner,
} from "~/components/ResolvedThreadBanner";

type Reaction = components["schemas"]["reaction"];

import { ReactionBar } from "~/components/ReactionBar";
import { ReactionPicker } from "~/components/ReactionPicker";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import { useTogglePullRequestReviewCommentReaction } from "~/hooks/use-reaction-toggle";
import {
    applyReviewThreadOperations,
    useReviewThreadOperations,
} from "~/hooks/use-review-thread-operations";
import type { ReactionContent } from "~/lib/reactions";
import type { ReviewComment } from "~/server/github";
import { api } from "~/trpc/react";
import { MarkdownEditor } from "./markdown/MarkdownEditor";
import { MarkdownRenderer } from "./markdown/MarkdownRenderer";

interface InlineCommentThreadProps {
    parentComment: ReviewComment;
    replies: ReviewComment[];
    owner: string;
    repo: string;
    number: number;
    pendingReviewId?: number | null;
    canInteract?: boolean;
}

export function InlineCommentThread({
    parentComment,
    replies,
    owner,
    repo,
    number,
    pendingReviewId,
    canInteract = true,
}: InlineCommentThreadProps) {
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [replyBody, setReplyBody] = useState("");
    const [expandedResolved, setExpandedResolved] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState<number | null>(
        null,
    );
    const [editBody, setEditBody] = useState("");
    const [savedBodies, setSavedBodies] = useState<Record<number, string>>({});
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
        onSuccess: () => {
            setReplyBody("");
            setShowReplyForm(false);
            utils.reviewComments.list.invalidate();
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
        updateMutation.mutate({ owner, repo, commentId, body: editBody });
    };

    const handleReact = useCallback(
        (commentId: number, content: ReactionContent) => {
            reactMutation.mutate({ owner, repo, commentId, content });
        },
        [reactMutation, owner, repo],
    );

    const deleteMutation = api.reviewComments.delete.useMutation({
        onSuccess: () => {
            utils.reviewComments.list.invalidate({ owner, repo, number });
        },
    });

    const { data: threads } = api.reviewComments.threads.useQuery(
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
                comment={parentComment}
                isPending={
                    pendingReviewId != null &&
                    parentComment.pull_request_review_id === pendingReviewId
                }
                isAuthor={parentComment.user?.login === currentUserLogin}
                isEditing={editingCommentId === parentComment.id}
                editBody={editingCommentId === parentComment.id ? editBody : ""}
                displayBody={
                    savedBodies[parentComment.id] ?? parentComment.body
                }
                reactions={reactionMap[parentComment.id] ?? []}
                currentUserLogin={currentUserLogin}
                canInteract={canInteract}
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
                owner={owner}
                repo={repo}
                number={number}
                threadId={threadInfo?.id ?? ""}
                variant="parent"
            />

            {replies.map((comment) => (
                <div className="bg-gray-50 dark:bg-zinc-950" key={comment.id}>
                    <Comment
                        comment={comment}
                        isPending={
                            pendingReviewId != null &&
                            comment.pull_request_review_id === pendingReviewId
                        }
                        isAuthor={comment.user?.login === currentUserLogin}
                        isEditing={editingCommentId === comment.id}
                        editBody={
                            editingCommentId === comment.id ? editBody : ""
                        }
                        displayBody={savedBodies[comment.id] ?? comment.body}
                        reactions={reactionMap[comment.id] ?? []}
                        currentUserLogin={currentUserLogin}
                        canInteract={canInteract}
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
                    />
                </div>
            ))}
            {canInteract ? (
                showReplyForm ? (
                    <div className="bg-gray-50 p-2 dark:bg-zinc-950">
                        <MarkdownEditor
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
                    <div className="flex w-full items-center gap-2 bg-gray-50 px-6 py-2 dark:bg-zinc-950">
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
    isAuthor,
    isEditing,
    editBody,
    displayBody,
    reactions,
    currentUserLogin,
    canInteract,
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
}: {
    comment: ReviewComment;
    isPending: boolean;
    isAuthor: boolean;
    isEditing: boolean;
    editBody: string;
    displayBody: string;
    reactions: Reaction[];
    currentUserLogin: string;
    canInteract: boolean;
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
}) {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <CommentCard
            user={comment.user}
            createdAt={comment.created_at}
            authorAssociation={comment.author_association}
            isPending={isPending}
            isEditing={isEditing}
            editBody={editBody}
            onEditBodyChange={onEditBodyChange}
            onCancelEdit={onCancelEdit}
            onSaveEdit={onSaveEdit}
            owner={owner}
            repo={repo}
            variant={variant === "parent" ? "default" : "nested"}
            headerActions={
                <>
                    <ReactionPicker
                        disabled={!canInteract}
                        reactions={reactions}
                        currentUserLogin={currentUserLogin}
                        onReact={onReact}
                    />
                    {isAuthor && canInteract && (
                        <button
                            type="button"
                            aria-label="Edit comment"
                            className="cursor-pointer rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-gray-300"
                            onClick={onStartEdit}
                        >
                            <SquarePen size={14} />
                        </button>
                    )}
                    {canInteract && (
                        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    className="cursor-pointer rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-gray-300"
                                >
                                    <MoreVertical size={14} />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent
                                className="w-44 bg-white p-1 dark:bg-zinc-950"
                                align="end"
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        onDelete();
                                        setMenuOpen(false);
                                    }}
                                    className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-gray-700 text-sm transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-300 dark:hover:bg-red-950 dark:hover:text-red-400"
                                >
                                    <Trash2 size={14} />
                                    Delete comment
                                </button>
                            </PopoverContent>
                        </Popover>
                    )}
                </>
            }
            footer={
                <div className="mx-6 flex flex-wrap items-center gap-1.5 px-4 pb-3">
                    <ReactionBar
                        disabled={!canInteract}
                        reactions={reactions}
                        currentUserLogin={currentUserLogin}
                        onReact={onReact}
                    />
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
            />
        </CommentCard>
    );
}

export function ReplyTextboxButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            className="flex w-full cursor-text items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-gray-400 text-xs transition-colors duration-200 hover:border-gray-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-gray-500 dark:hover:border-zinc-400"
            onClick={onClick}
        >
            Reply...
        </button>
    );
}
