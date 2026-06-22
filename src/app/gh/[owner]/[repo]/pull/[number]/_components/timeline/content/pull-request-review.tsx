"use client";

import { SquarePen } from "lucide-react";
import { CommentCard } from "~/components/CommentCard";
import { MarkdownRenderer } from "~/components/markdown/MarkdownRenderer";
import { ReactionBar } from "~/components/ReactionBar";
import { ReactionPicker } from "~/components/ReactionPicker";
import { UserLink } from "~/components/user-link";
import type { ReactionContent } from "~/lib/reactions";
import type { ReviewComment } from "~/server/github";
import type {
    GQLPullRequestReview,
    GQLReactionNode,
} from "~/server/github-graphql";
import { formatRelativeTime } from "~/utils";
import { ReviewComments } from "../../review-comments";

interface PullRequestReviewContentProps {
    event: GQLPullRequestReview;
    owner: string;
    repo: string;
    number: number;
    currentUserLogin: string;
    canInteract: boolean;
    allComments: ReviewComment[];
    commentReactions: Record<number, GQLReactionNode[]>;
    editingCommentId: number | null;
    editBody: string;
    savedBodies: Record<number, string>;
    onEditBodyChange: (body: string) => void;
    onStartEdit: (reviewId: number, body: string) => void;
    onCancelEdit: () => void;
    onSaveEdit: (reviewId: number, body: string) => void;
    onReactToReview: (
        subjectId: string,
        databaseId: number,
        content: ReactionContent,
    ) => void;
}

export function PullRequestReviewContent({
    event,
    owner,
    repo,
    number,
    currentUserLogin,
    canInteract,
    allComments,
    commentReactions,
    editingCommentId,
    editBody,
    savedBodies,
    onEditBodyChange,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onReactToReview,
}: PullRequestReviewContentProps) {
    const isEditing = editingCommentId === event.databaseId;
    const isAuthor = event.author?.login === currentUserLogin;
    const displayBody = savedBodies[event.databaseId] ?? event.body;
    const reviewReactionsArr = commentReactions[event.databaseId] ?? [];

    const timestamp = formatRelativeTime(event.submittedAt ?? event.createdAt);
    const state = event.state.toLowerCase();
    const STATE_LABELS: Record<string, string> = {
        pending: "started a review",
        approved: "approved these changes",
        changes_requested: "requested changes",
    };
    const stateLabel = STATE_LABELS[state] ?? "reviewed";

    return (
        <>
            <p className="flex items-center gap-1 text-gray-600 text-sm dark:text-zinc-400">
                <UserLink actor={event.author} />
                {` ${stateLabel} ${timestamp}`}
            </p>
            {event.body && (
                <div className="mt-2">
                    <CommentCard
                        user={
                            event.author
                                ? {
                                      login: event.author.login,
                                      avatar_url: event.author.avatarUrl,
                                  }
                                : null
                        }
                        variant="standalone"
                        userHref={event.author?.url}
                        createdAt={event.submittedAt ?? event.createdAt}
                        authorAssociation={event.authorAssociation}
                        isEditing={isEditing}
                        editBody={editBody}
                        onEditBodyChange={onEditBodyChange}
                        onCancelEdit={onCancelEdit}
                        onSaveEdit={() => {
                            onSaveEdit(event.databaseId, editBody);
                        }}
                        owner={owner}
                        repo={repo}
                        headerActions={
                            <div className="flex items-center gap-1">
                                {!isEditing && currentUserLogin && (
                                    <ReactionPicker
                                        disabled={!canInteract}
                                        reactions={reviewReactionsArr}
                                        currentUserLogin={currentUserLogin}
                                        onReact={(content) =>
                                            onReactToReview(
                                                event.id,
                                                event.databaseId,
                                                content,
                                            )
                                        }
                                    />
                                )}
                                {isAuthor && canInteract && (
                                    <button
                                        type="button"
                                        className="cursor-pointer rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-gray-300"
                                        onClick={() => {
                                            onStartEdit(
                                                event.databaseId,
                                                displayBody,
                                            );
                                        }}
                                    >
                                        <SquarePen size={14} />
                                    </button>
                                )}
                            </div>
                        }
                        footer={
                            !isEditing &&
                            reviewReactionsArr.length > 0 && (
                                <div className="px-3 pb-3">
                                    <ReactionBar
                                        disabled={!canInteract}
                                        reactions={reviewReactionsArr}
                                        currentUserLogin={currentUserLogin}
                                        onReact={(content) =>
                                            onReactToReview(
                                                event.id,
                                                event.databaseId,
                                                content,
                                            )
                                        }
                                    />
                                </div>
                            )
                        }
                    >
                        <MarkdownRenderer
                            content={displayBody}
                            owner={owner}
                            repo={repo}
                        />
                    </CommentCard>
                </div>
            )}
            <ReviewComments
                owner={owner}
                repo={repo}
                number={number}
                reviewId={event.databaseId}
                state={state}
                allComments={allComments}
                currentUserLogin={currentUserLogin}
                canInteract={canInteract}
            />
        </>
    );
}
