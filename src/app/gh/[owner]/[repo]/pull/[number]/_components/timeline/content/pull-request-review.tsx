"use client";

import {
    Check,
    ChevronDown,
    Eye,
    EyeOff,
    Link,
    MoreVertical,
    SquarePen,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { CommentCard } from "~/components/comment-card";
import { MarkdownRenderer } from "~/components/markdown/markdown-renderer";
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
import { UserLink } from "~/components/user-link";
import { type TaskToggleApi, useTaskToggle } from "~/hooks/use-task-toggle";
import type { ReactionContent } from "~/lib/reactions";
import { TIMELINE_PAGE_SIZE } from "~/lib/timeline-constants";
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
import { formatReason } from "../event";

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
    const [copied, setCopied] = useState(false);
    const [hideDialogOpen, setHideDialogOpen] = useState(false);

    const { onToggleTask } = useTaskToggle({
        mutation: reviewToggleMutation,
        staticInput: { owner, repo, number, reviewId: event.databaseId },
    });

    const handleCopyLink = useCallback(async () => {
        const url = `${window.location.origin}${window.location.pathname}#pullrequestreview-${event.databaseId}`;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [event.databaseId]);

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
    const timelineCacheKey = {
        owner,
        repo,
        number,
        limit: TIMELINE_PAGE_SIZE,
    } as const;

    const minimizeMutation = api.reviews.minimize.useMutation({
        onMutate: async ({ subjectId, classifier }) => {
            await utils.timeline.list.cancel(timelineCacheKey);

            const prevData =
                utils.timeline.list.getInfiniteData(timelineCacheKey);

            utils.timeline.list.setInfiniteData(timelineCacheKey, (old) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        events: page.events.map((ev) =>
                            ev.__typename === "PullRequestReview" &&
                            ev.id === subjectId
                                ? {
                                      ...ev,
                                      isMinimized: true,
                                      minimizedReason: classifier.toLowerCase(),
                                  }
                                : ev,
                        ),
                    })),
                };
            });

            return { prevData };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prevData) {
                utils.timeline.list.setInfiniteData(
                    timelineCacheKey,
                    ctx.prevData,
                );
            }
        },
        onSuccess: () => {
            onToggleMinimized(event.databaseId, false);
        },
        onSettled: () => {
            utils.timeline.list.invalidate(timelineCacheKey);
        },
    });

    const unminimizeMutation = api.reviews.unminimize.useMutation({
        onMutate: async ({ subjectId }) => {
            await utils.timeline.list.cancel(timelineCacheKey);

            const prevData =
                utils.timeline.list.getInfiniteData(timelineCacheKey);

            utils.timeline.list.setInfiniteData(timelineCacheKey, (old) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        events: page.events.map((ev) =>
                            ev.__typename === "PullRequestReview" &&
                            ev.id === subjectId
                                ? {
                                      ...ev,
                                      isMinimized: false,
                                      minimizedReason: null,
                                  }
                                : ev,
                        ),
                    })),
                };
            });

            return { prevData };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prevData) {
                utils.timeline.list.setInfiniteData(
                    timelineCacheKey,
                    ctx.prevData,
                );
            }
        },
        onSettled: () => {
            utils.timeline.list.invalidate(timelineCacheKey);
        },
    });

    if (isMinimized) {
        return (
            <div className="/50 rounded-lg border border-border bg-surface-secondary p-3">
                <div className="flex items-center justify-between">
                    <p className="text-sm text-text-tertiary">
                        A review by{" "}
                        <span className="font-medium text-text-label">
                            {event.author?.login ?? "unknown"}
                        </span>{" "}
                        was minimized as{" "}
                        <span className="font-medium text-text-label">
                            {event.minimizedReason
                                ? formatReason(event.minimizedReason)
                                : "outdated"}
                        </span>
                    </p>
                    <button
                        type="button"
                        onClick={() =>
                            onToggleMinimized(event.databaseId, true)
                        }
                        className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-text-tertiary text-xs transition-colors hover:bg-surface-selected hover:text-text-label dark:hover:text-zinc-300"
                    >
                        <ChevronDown size={14} />
                        Show review
                    </button>
                </div>
            </div>
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
                                {event.body && !isEditing && (
                                    <Popover
                                        open={menuOpen}
                                        onOpenChange={setMenuOpen}
                                    >
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
                                                    handleCopyLink();
                                                    setMenuOpen(false);
                                                }}
                                                className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-text-label transition-colors hover:bg-surface-tertiary"
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
                                            {(isAuthor || _canEdit) &&
                                                _canInteract && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            onStartEdit(
                                                                event.databaseId,
                                                                displayBody,
                                                            );
                                                            setMenuOpen(false);
                                                        }}
                                                        className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-text-label transition-colors hover:bg-surface-tertiary"
                                                    >
                                                        <SquarePen size={14} />
                                                        Edit
                                                    </button>
                                                )}
                                            {_canInteract &&
                                                !isPendingByCurrentUser &&
                                                (event.isMinimized ? (
                                                    <button
                                                        type="button"
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
                                                        className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-text-label transition-colors hover:bg-surface-tertiary"
                                                    >
                                                        <Eye size={14} />
                                                        Unhide
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setMenuOpen(false);
                                                            setHideDialogOpen(
                                                                true,
                                                            );
                                                        }}
                                                        className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-text-label transition-colors hover:bg-surface-tertiary"
                                                    >
                                                        <EyeOff size={14} />
                                                        Hide
                                                    </button>
                                                ))}
                                        </PopoverContent>
                                    </Popover>
                                )}
                            </div>
                        }
                        footer={
                            !isEditing &&
                            _canInteract && (
                                <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
                                    <ReactionPicker
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
                                    <ReactionBar
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
                                </div>
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
                    </CommentCard>
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
