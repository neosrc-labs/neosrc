"use client";

import type { components } from "@octokit/openapi-types";
import { SquarePen } from "lucide-react";
import { useMemo, useState } from "react";
import { CommentCard } from "~/components/CommentCard";
import { DiffView } from "~/components/DiffView";
import { ReplyTextboxButton } from "~/components/InlineCommentThread";
import { MarkdownEditor } from "~/components/markdown/MarkdownEditor";
import { MarkdownRenderer } from "~/components/markdown/MarkdownRenderer";
import { ReactionBar } from "~/components/ReactionBar";
import { ReactionPicker } from "~/components/ReactionPicker";
import { useTogglePullRequestReviewCommentReaction } from "~/hooks/use-reaction-toggle";
import type { ReactionContent } from "~/lib/reactions";
import type { ReviewComment } from "~/server/github";
import { api } from "~/trpc/react";

type Reaction = components["schemas"]["reaction"];

interface ReviewCommentsProps {
    owner: string;
    repo: string;
    number: number;
    reviewId: number;
    state?: string;
    allComments: ReviewComment[];
    currentUserLogin: string;
}

export function ReviewComments({
    owner,
    repo,
    number,
    reviewId,
    state,
    allComments,
    currentUserLogin,
}: ReviewCommentsProps) {
    const [editingCommentId, setEditingCommentId] = useState<number | null>(
        null,
    );
    const [editBody, setEditBody] = useState("");
    const [savedBodies, setSavedBodies] = useState<Record<number, string>>({});

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

    const handleReact = (commentId: number, content: ReactionContent) => {
        reactMutation.mutate({ owner, repo, commentId, content });
    };

    const handleSaveEdit = (commentId: number) => {
        if (!editBody.trim()) return;
        updateMutation.mutate({ owner, repo, commentId, body: editBody });
    };

    const replyMap = useMemo(() => {
        const map = new Map<number, ReviewComment[]>();
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

    const byPath: Record<string, ReviewComment[]> = {};
    for (const comment of topLevel) {
        const path = comment.path;
        if (!byPath[path]) byPath[path] = [];
        byPath[path].push(comment);
    }

    return (
        <div className="space-y-3 pt-3">
            {Object.entries(byPath).map(([path, fileComments]) => (
                <div
                    key={path}
                    className="mt-3 overflow-hidden rounded border border-gray-200 dark:border-zinc-700"
                >
                    <div className="border-gray-200 border-b bg-gray-50 px-3 py-1.5 font-mono text-gray-600 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                        {path}
                    </div>
                    <div className="divide-y divide-gray-200 dark:divide-zinc-700">
                        {fileComments.map((comment) => (
                            <CommentBlock
                                key={comment.id}
                                comment={comment}
                                replies={replyMap.get(comment.id) ?? []}
                                owner={owner}
                                repo={repo}
                                number={number}
                                state={state}
                                currentUserLogin={currentUserLogin}
                                reactionMap={reactionMap}
                                editingCommentId={editingCommentId}
                                editBody={editBody}
                                savedBodies={savedBodies}
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
                                onReact={handleReact}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function CommentBlock({
    comment,
    replies,
    owner,
    repo,
    number,
    state,
    currentUserLogin,
    reactionMap,
    editingCommentId,
    editBody,
    savedBodies,
    onStartEdit,
    onEditBodyChange,
    onCancelEdit,
    onSaveEdit,
    onReact,
}: {
    comment: ReviewComment;
    replies: ReviewComment[];
    owner: string;
    repo: string;
    number: number;
    state?: string;
    currentUserLogin: string;
    reactionMap: Record<number, Reaction[]>;
    editingCommentId: number | null;
    editBody: string;
    savedBodies: Record<number, string>;
    onStartEdit: (commentId: number, body: string) => void;
    onEditBodyChange: (body: string) => void;
    onCancelEdit: () => void;
    onSaveEdit: (commentId: number) => void;
    onReact: (commentId: number, content: ReactionContent) => void;
}) {
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [replyBody, setReplyBody] = useState("");
    const utils = api.useUtils();

    const replyMutation = api.reviewComments.reply.useMutation({
        onSuccess: () => {
            setReplyBody("");
            setShowReplyForm(false);
            utils.reviewComments.invalidate();
        },
    });

    if (!comment.user) {
        return null;
    }

    const parentReactions = reactionMap[comment.id] ?? [];

    return (
        <div
            id={`review-thread-${comment.id}`}
            className="bg-gray-50 dark:bg-zinc-950"
        >
            {comment.diff_hunk && (
                <div>
                    <DiffView
                        patch={comment.diff_hunk}
                        filename={comment.path}
                    />
                </div>
            )}
            <CommentCard
                user={comment.user}
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
                    <>
                        <ReactionPicker
                            reactions={parentReactions}
                            currentUserLogin={currentUserLogin}
                            onReact={(content) => onReact(comment.id, content)}
                        />
                        {comment.user?.login === currentUserLogin && (
                            <button
                                type="button"
                                className="cursor-pointer rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-gray-300"
                                onClick={() =>
                                    onStartEdit(
                                        comment.id,
                                        savedBodies[comment.id] ?? comment.body,
                                    )
                                }
                            >
                                <SquarePen size={14} />
                            </button>
                        )}
                    </>
                }
                footer={
                    parentReactions.length > 0 && (
                        <div className="mx-6 flex flex-wrap items-center gap-1.5 px-4 pb-3">
                            <ReactionBar
                                reactions={parentReactions}
                                currentUserLogin={currentUserLogin}
                                onReact={(content) =>
                                    onReact(comment.id, content)
                                }
                            />
                        </div>
                    )
                }
            >
                <MarkdownRenderer
                    content={savedBodies[comment.id] ?? comment.body}
                    owner={owner}
                    repo={repo}
                />
            </CommentCard>
            {replies.map((reply) => {
                if (!reply.user) return null;
                const replyReactions = reactionMap[reply.id] ?? [];
                return (
                    <div key={reply.id} className="mt-2 pl-3">
                        <CommentCard
                            user={reply.user}
                            createdAt={reply.created_at}
                            authorAssociation={reply.author_association}
                            owner={owner}
                            repo={repo}
                            variant="nested"
                            isEditing={editingCommentId === reply.id}
                            editBody={
                                editingCommentId === reply.id ? editBody : ""
                            }
                            onEditBodyChange={onEditBodyChange}
                            onCancelEdit={onCancelEdit}
                            onSaveEdit={() => onSaveEdit(reply.id)}
                            headerActions={
                                <>
                                    <ReactionPicker
                                        reactions={replyReactions}
                                        currentUserLogin={currentUserLogin}
                                        onReact={(content) =>
                                            onReact(reply.id, content)
                                        }
                                    />
                                    {reply.user?.login === currentUserLogin && (
                                        <button
                                            type="button"
                                            className="cursor-pointer rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-gray-300"
                                            onClick={() =>
                                                onStartEdit(
                                                    reply.id,
                                                    savedBodies[reply.id] ??
                                                        reply.body,
                                                )
                                            }
                                        >
                                            <SquarePen size={14} />
                                        </button>
                                    )}
                                </>
                            }
                            footer={
                                replyReactions.length > 0 && (
                                    <div className="mx-6 flex flex-wrap items-center gap-1.5 px-4 pb-3">
                                        <ReactionBar
                                            reactions={replyReactions}
                                            currentUserLogin={currentUserLogin}
                                            onReact={(content) =>
                                                onReact(reply.id, content)
                                            }
                                        />
                                    </div>
                                )
                            }
                        >
                            <MarkdownRenderer
                                content={savedBodies[reply.id] ?? reply.body}
                                owner={owner}
                                repo={repo}
                            />
                        </CommentCard>
                    </div>
                );
            })}
            {showReplyForm ? (
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
                                onClick: () => {
                                    if (!replyBody.trim()) return;
                                    replyMutation.mutate({
                                        owner,
                                        repo,
                                        number,
                                        body: replyBody,
                                        inReplyTo: comment.id,
                                    });
                                },
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
                <div className="flex w-full bg-gray-50 px-6 py-2 dark:bg-zinc-950">
                    <ReplyTextboxButton
                        onClick={() => setShowReplyForm(true)}
                    />
                </div>
            )}
        </div>
    );
}
