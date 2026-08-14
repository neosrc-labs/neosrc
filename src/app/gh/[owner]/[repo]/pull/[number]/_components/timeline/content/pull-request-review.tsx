"use client";

import { Eye, EyeOff } from "lucide-react";
import { useMemo, useState } from "react";
import {
    CommentMenu,
    CommentMenuItem,
    CopyLinkMenuItem,
    EditMenuItem,
} from "~/components/comment-menu";
import { CommentReactionFooter } from "~/components/comment-reaction-footer";
import { MarkdownRenderer } from "~/components/markdown/markdown-renderer";
import { MinimizedCommentBanner } from "~/components/minimized-comment-banner";
import {
    cancelTimelineList,
    getTimelineListData,
    timelineListKey,
    timelineRollbackHandlers,
    updateReviewMinimizedInTimeline,
} from "~/components/timeline-cache";
import { TimelineCommentCard } from "~/components/timeline-comment-card";
import { Button } from "~/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import { UserLink } from "~/components/user-link";
import { type TaskToggleApi, useTaskToggle } from "~/hooks/use-task-toggle";
import type { ReactionContent } from "~/lib/reactions";
import type { ReviewComment, ReviewMinimizeClassifier } from "~/server/github";
import type {
    GQLPullRequestReview,
    GQLReactionNode,
} from "~/server/github-graphql";
import { api } from "~/trpc/react";
import { formatDateTime, formatRelativeTime } from "~/utils";
import {
    canEdit,
    canInteract,
    type PullRequestPermissionContext,
} from "../../../permissions-utils";
import { ReviewComments } from "../../review-comments";

const REVIEW_MINIMIZE_REASONS: {
    value: ReviewMinimizeClassifier;
    label: string;
}[] = [
    { value: "OUTDATED", label: "Outdated" },
    { value: "OFF_TOPIC", label: "Off-topic" },
    { value: "DUPLICATE", label: "Duplicate" },
    { value: "SPAM", label: "Spam" },
    { value: "ABUSE", label: "Abuse" },
];

interface PullRequestReviewContentProps {
    event: GQLPullRequestReview;
    owner: string;
    repo: string;
    number: number;
    permissionContext: PullRequestPermissionContext;
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
    expandedMinimized: Record<number, boolean>;
    onToggleMinimized: (reviewId: number, expanded: boolean) => void;
    reviewToggleMutation: TaskToggleApi<{
        owner: string;
        repo: string;
        number: number;
        reviewId: number;
        body: string;
    }>;
}

export function PullRequestReviewContent({
    event,
    owner,
    repo,
    number,
    permissionContext,
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
    expandedMinimized,
    onToggleMinimized,
    reviewToggleMutation,
}: PullRequestReviewContentProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [hideDialogOpen, setHideDialogOpen] = useState(false);

    const { onToggleTask } = useTaskToggle({
        mutation: reviewToggleMutation,
        staticInput: { owner, repo, number, reviewId: event.databaseId },
    });

    const isEditing = editingCommentId === event.databaseId;
    const isAuthor = event.author?.login === permissionContext.currentUser;
    const displayBody = savedBodies[event.databaseId] ?? event.body;
    const reviewReactionsArr = commentReactions[event.databaseId] ?? [];
    const _canInteract = canInteract(permissionContext);
    const _canEdit = canEdit(permissionContext);

    const timestamp = formatRelativeTime(event.submittedAt ?? event.createdAt);
    const fullDate = formatDateTime(event.submittedAt ?? event.createdAt);
    const state = event.state.toLowerCase();
    const STATE_LABELS: Record<string, string> = {
        pending: "started a review",
        approved: "approved these changes",
        changes_requested: "requested changes",
    };
    const stateLabel = STATE_LABELS[state] ?? "reviewed";

    const isPendingByCurrentUser =
        state === "pending" &&
        event.author?.login === permissionContext.currentUser;

    const isMinimized =
        event.isMinimized && !expandedMinimized[event.databaseId];

    const { data: pendingComments = [] } =
        api.reviewComments.byReviewId.useQuery(
            { owner, repo, number, reviewId: event.databaseId },
            { enabled: isPendingByCurrentUser, staleTime: 30_000 },
        );

    const mergedComments = useMemo(() => {
        if (!isPendingByCurrentUser || pendingComments.length === 0) {
            return allComments;
        }
        const existingIds = new Set(allComments.map((c) => c.id));
        const newComments = pendingComments.filter(
            (c) => !existingIds.has(c.id),
        );
        return [...allComments, ...newComments];
    }, [allComments, pendingComments, isPendingByCurrentUser]);

    const utils = api.useUtils();
    const timelineKey = timelineListKey({ owner, repo, number });

    const minimizeMutation = api.reviews.minimize.useMutation({
        onMutate: async ({ subjectId, classifier }) => {
            await cancelTimelineList(utils, timelineKey);

            const prevData = getTimelineListData(utils, timelineKey);

            updateReviewMinimizedInTimeline(
                utils,
                timelineKey,
                subjectId,
                true,
                classifier.toLowerCase(),
            );

            return { prevData };
        },
        onSuccess: () => {
            onToggleMinimized(event.databaseId, false);
        },
        ...timelineRollbackHandlers(utils, timelineKey),
    });

    const unminimizeMutation = api.reviews.unminimize.useMutation({
        onMutate: async ({ subjectId }) => {
            await cancelTimelineList(utils, timelineKey);

            const prevData = getTimelineListData(utils, timelineKey);

            updateReviewMinimizedInTimeline(
                utils,
                timelineKey,
                subjectId,
                false,
                null,
            );

            return { prevData };
        },
        ...timelineRollbackHandlers(utils, timelineKey),
    });

    if (isMinimized) {
        return (
            <MinimizedCommentBanner
                subject="review"
                authorLogin={event.author?.login}
                minimizedReason={event.minimizedReason}
                onShow={() => onToggleMinimized(event.databaseId, true)}
            />
        );
    }

    return (
        <>
            <p className="flex items-center gap-1 text-sm text-text-secondary">
                <UserLink actor={event.author} />
                {` ${stateLabel} `}
                <span title={fullDate}>{timestamp}</span>
            </p>
            {event.body && (
                <div className="mt-3">
                    <TimelineCommentCard
                        id={`pullrequestreview-${event.databaseId}`}
                        user={
                            event.author
                                ? {
                                      login: event.author.login,
                                      avatar_url: event.author.avatarUrl,
                                  }
                                : null
                        }
                        tailDirection="up"
                        userHref={event.author?.url}
                        databaseId={event.databaseId}
                        createdAt={event.submittedAt ?? event.createdAt}
                        authorAssociation={event.authorAssociation}
                        isEditing={isEditing}
                        editBody={editBody}
                        onEditBodyChange={onEditBodyChange}
                        onCancelEdit={onCancelEdit}
                        onSaveEdit={onSaveEdit}
                        owner={owner}
                        repo={repo}
                        headerActions={
                            <div className="flex items-center gap-1">
                                {event.body && !isEditing && (
                                    <CommentMenu
                                        open={menuOpen}
                                        onOpenChange={setMenuOpen}
                                    >
                                        <CopyLinkMenuItem
                                            anchor={`pullrequestreview-${event.databaseId}`}
                                            onClose={() => setMenuOpen(false)}
                                        />
                                        {(isAuthor || _canEdit) &&
                                            _canInteract && (
                                                <EditMenuItem
                                                    onClick={() =>
                                                        onStartEdit(
                                                            event.databaseId,
                                                            displayBody,
                                                        )
                                                    }
                                                    onClose={() =>
                                                        setMenuOpen(false)
                                                    }
                                                />
                                            )}
                                        {_canInteract &&
                                            !isPendingByCurrentUser &&
                                            (event.isMinimized ? (
                                                <CommentMenuItem
                                                    onClick={() => {
                                                        setMenuOpen(false);
                                                        unminimizeMutation.mutate(
                                                            {
                                                                owner,
                                                                repo,
                                                                number,
                                                                subjectId:
                                                                    event.id,
                                                            },
                                                        );
                                                    }}
                                                >
                                                    <Eye size={14} />
                                                    Unhide
                                                </CommentMenuItem>
                                            ) : (
                                                <CommentMenuItem
                                                    onClick={() => {
                                                        setMenuOpen(false);
                                                        setHideDialogOpen(true);
                                                    }}
                                                >
                                                    <EyeOff size={14} />
                                                    Hide
                                                </CommentMenuItem>
                                            ))}
                                    </CommentMenu>
                                )}
                            </div>
                        }
                        footer={
                            !isEditing &&
                            _canInteract && (
                                <CommentReactionFooter
                                    reactions={reviewReactionsArr}
                                    currentUserLogin={
                                        permissionContext.currentUser
                                    }
                                    onReact={(content) =>
                                        onReactToReview(
                                            event.id,
                                            event.databaseId,
                                            content,
                                        )
                                    }
                                />
                            )
                        }
                    >
                        <MarkdownRenderer
                            content={displayBody}
                            owner={owner}
                            repo={repo}
                            onToggleTask={onToggleTask}
                            canToggleTasks={
                                (isAuthor || _canEdit) && _canInteract
                            }
                        />
                    </TimelineCommentCard>
                </div>
            )}
            <ReviewComments
                owner={owner}
                repo={repo}
                number={number}
                reviewId={event.databaseId}
                hasReviewBody={Boolean(event.body)}
                state={state}
                allComments={mergedComments}
                permissionContext={permissionContext}
            />
            <Dialog open={hideDialogOpen} onOpenChange={setHideDialogOpen}>
                <DialogContent showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle>Hide review</DialogTitle>
                        <DialogDescription>
                            Select a reason for hiding this review by{" "}
                            {event.author?.login ?? "unknown"}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-1">
                        {REVIEW_MINIMIZE_REASONS.map((reason) => (
                            <button
                                key={reason.value}
                                type="button"
                                onClick={() => {
                                    setHideDialogOpen(false);
                                    minimizeMutation.mutate({
                                        owner,
                                        repo,
                                        number,
                                        subjectId: event.id,
                                        classifier: reason.value,
                                    });
                                }}
                                className="flex w-full cursor-pointer items-center rounded px-2 py-1.5 text-sm text-text-label transition-colors hover:bg-surface-tertiary"
                            >
                                {reason.label}
                            </button>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setHideDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
