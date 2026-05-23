"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { CommentCard } from "~/components/CommentCard";
import { DiffView } from "~/components/DiffView";
import { MarkdownEditor } from "~/components/markdown/MarkdownEditor";
import { MarkdownRenderer } from "~/components/markdown/MarkdownRenderer";
import type { ReviewCommentsForReviewData } from "~/server/github";
import { api } from "~/trpc/react";

type ReviewComment = ReviewCommentsForReviewData[number];

interface ReviewCommentsProps {
    owner: string;
    repo: string;
    number: number;
    reviewId: number;
    state?: string;
    allComments: ReviewComment[];
}

export function ReviewComments({
    owner,
    repo,
    number,
    reviewId,
    state,
    allComments,
}: ReviewCommentsProps) {
    const { data: comments, isLoading } =
        api.reviewComments.byReviewId.useQuery({
            owner,
            repo,
            number,
            reviewId,
        });

    if (isLoading) {
        return (
            <div className="mt-2 flex items-center gap-2 text-gray-400 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading review comments...
            </div>
        );
    }

    if (!comments || comments.length === 0) {
        return null;
    }

    const topLevel: ReviewComment[] = [];
    const replyMap = new Map<number, ReviewComment[]>();

    for (const comment of allComments) {
        if (comment.in_reply_to_id) {
            const existing = replyMap.get(comment.in_reply_to_id) ?? [];
            existing.push(comment);
            replyMap.set(comment.in_reply_to_id, existing);
        } else if (comment.pull_request_review_id === reviewId) {
            topLevel.push(comment);
        }
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
}: {
    comment: ReviewComment;
    replies: ReviewComment[];
    owner: string;
    repo: string;
    number: number;
    state?: string;
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

    return (
        <div id={`review-thread-${comment.id}`}>
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
            >
                <MarkdownRenderer
                    content={comment.body}
                    owner={owner}
                    repo={repo}
                />
            </CommentCard>
            {replies.map((reply) => {
                if (!reply.user) return null;
                return (
                    <div key={reply.id} className="mt-2 pl-3">
                        <CommentCard
                            user={reply.user}
                            createdAt={reply.created_at}
                            authorAssociation={reply.author_association}
                            owner={owner}
                            repo={repo}
                            variant="nested"
                        >
                            <MarkdownRenderer
                                content={reply.body}
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
                    <button
                        type="button"
                        className="flex w-full cursor-text items-center rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-gray-400 text-xs transition-colors duration-200 hover:border-gray-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-gray-500 dark:hover:border-zinc-400"
                        onClick={() => setShowReplyForm(true)}
                    >
                        Reply...
                    </button>
                </div>
            )}
        </div>
    );
}
