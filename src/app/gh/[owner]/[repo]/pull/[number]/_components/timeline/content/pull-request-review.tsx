"use client";

import { Check, Link, MoreVertical, SquarePen } from "lucide-react";
import { useCallback, useState } from "react";
import { CommentCard } from "~/components/CommentCard";
import { MarkdownRenderer } from "~/components/markdown/MarkdownRenderer";
import { ReactionBar } from "~/components/ReactionBar";
import { ReactionPicker } from "~/components/ReactionPicker";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
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
    const [menuOpen, setMenuOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopyLink = useCallback(async () => {
        const url = `${window.location.origin}${window.location.pathname}#pullrequestreview-${event.databaseId}`;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [event.databaseId]);

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
            <p className="flex items-center gap-1 text-sm text-text-secondary">
                <UserLink actor={event.author} />
                {` ${stateLabel} ${timestamp}`}
            </p>
            {event.body && (
                <div className="mt-3">
                    <CommentCard
                        id={`pullrequestreview-${event.databaseId}`}
                        user={
                            event.author
                                ? {
                                      login: event.author.login,
                                      avatar_url: event.author.avatarUrl,
                                  }
                                : null
                        }
                        variant="standalone"
                        hideAvatar
                        tailDirection="up"
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
                                {event.body && !isEditing && (
                                    <Popover
                                        open={menuOpen}
                                        onOpenChange={setMenuOpen}
                                    >
                                        <PopoverTrigger asChild>
                                            <button
                                                type="button"
                                                aria-label="More options"
                                                className="cursor-pointer rounded p-1 text-text-muted transition-colors hover:bg-gray-100 hover:text-text-secondary dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
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
                                                    handleCopyLink();
                                                    setMenuOpen(false);
                                                }}
                                                className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-text-label transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800"
                                            >
                                                {copied ? (
                                                    <Check size={14} />
                                                ) : (
                                                    <Link size={14} />
                                                )}
                                                {copied
                                                    ? "Copied"
                                                    : "Copy link"}
                                            </button>
                                            {isAuthor && canInteract && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onStartEdit(
                                                            event.databaseId,
                                                            displayBody,
                                                        );
                                                        setMenuOpen(false);
                                                    }}
                                                    className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-text-label transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800"
                                                >
                                                    <SquarePen size={14} />
                                                    Edit
                                                </button>
                                            )}
                                        </PopoverContent>
                                    </Popover>
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
