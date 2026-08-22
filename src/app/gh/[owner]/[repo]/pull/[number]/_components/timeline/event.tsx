"use client";

import {
    ArrowUp,
    Check,
    CheckCheck,
    Circle,
    ClipboardList,
    Clock,
    Eye,
    FileText,
    GitBranch,
    GitCommitHorizontal,
    GitMerge,
    GitPullRequestArrow,
    GitPullRequestClosed,
    Link,
    ListOrdered,
    Lock,
    LockOpen,
    Pencil,
    RefreshCw,
    Rocket,
    Tag,
    Target,
    Trash2,
    User,
    X,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import { Label } from "~/components/ui/label";
import { UserLink } from "~/components/user-link";
import type { ReactionContent } from "~/lib/reactions";
import { toggleReactionInList } from "~/lib/reactions";
import { TIMELINE_PAGE_SIZE } from "~/lib/timeline-constants";
import type { ReviewComment } from "~/server/github";
import type {
    GQLReactionNode,
    GQLTimelineEvent,
} from "~/server/github-graphql";
import { api } from "~/trpc/react";
import { formatDateTime, formatRelativeTime } from "~/utils";
import type { PullRequestPermissionContext } from "../../permissions-utils";
import { AssignedEventContent } from "./content/assigned-event";
import { AutoMergeEventContent } from "./content/auto-merge-event";
import { BaseRefChangedContent } from "./content/base-ref-changed";
import { CrossReferencedEventContent } from "./content/cross-referenced-event";
import { DeployedEventContent } from "./content/deployed-event";
import { HeadRefEventContent } from "./content/head-ref-event";
import { HeadRefForcePushContent } from "./content/head-ref-force-push";
import { IssueCommentContent } from "./content/issue-comment";
import { LockedEventContent } from "./content/locked-event";
import { MergeQueueEventContent } from "./content/merge-queue-event";
import { MergedEventContent } from "./content/merged-event";
import { MilestoneEventContent } from "./content/milestone-event";
import { ProjectEventContent } from "./content/project-event";
import { PullRequestCommitContent } from "./content/pull-request-commit";
import { PullRequestReviewContent } from "./content/pull-request-review";
import { ReferencedEventContent } from "./content/reference-event";
import { RenamedTitleContent } from "./content/renamed-title";
import { ReviewDismissedContent } from "./content/review-dismissed";
import { ReviewRequestEventContent } from "./content/review-request-event";
import { StateEventContent } from "./content/state-event";
import type { TimelineWrapper } from "./types";
import { approvalHasWriteAccess } from "./utils";

export const formatReason = (reason: string) =>
    reason
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

interface TimelineEventProps {
    wrapper: TimelineWrapper;
    owner: string;
    repo: string;
    number: number;
    commentReactions: Record<string, GQLReactionNode[]>;
    allComments: ReviewComment[];
    permissionContext: PullRequestPermissionContext;
}

export function TimelineEvent({
    wrapper,
    owner,
    repo,
    number,
    commentReactions,
    allComments,
    permissionContext,
}: TimelineEventProps) {
    if (wrapper.type === "aggregated-label") {
        return <AggregatedLabel wrapper={wrapper} />;
    }

    return (
        <div className="relative mb-8 ml-14">
            <TimelineIcon event={wrapper.event} />

            <div
                // content-visibility: auto implies paint containment, which clips
                // anything drawn outside this box. The CommentCard speech-bubble
                // tail (issue comments) hangs 8px left of the card, so extend the
                // box leftward (negative margin plus padding) without moving the
                // card itself. The review-card up-tail stays inside because a
                // header row sits above it.
                className="-ml-2 pt-1 pl-2"
                style={{
                    contentVisibility: "auto",
                    containIntrinsicSize: "200px",
                }}
            >
                <EventContent
                    event={wrapper.event}
                    owner={owner}
                    repo={repo}
                    number={number}
                    commentReactions={commentReactions}
                    allComments={allComments}
                    permissionContext={permissionContext}
                />
            </div>
        </div>
    );
}

function AggregatedLabel({
    wrapper,
}: {
    wrapper: Extract<TimelineWrapper, { type: "aggregated-label" }>;
}) {
    const { actor, changes, createdAt } = wrapper;
    const timestamp = formatRelativeTime(createdAt);
    const fullDate = formatDateTime(createdAt);
    const added = changes.filter((c) => c.event === "labeled");
    const removed = changes.filter((c) => c.event === "unlabeled");
    const total = changes.length;

    return (
        <div className="relative mb-8 ml-14">
            <div className="absolute -left-12 flex h-8 w-8 items-center justify-center rounded-full bg-surface ring-1 ring-border">
                <Tag size={ICON_SIZE} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-sm text-text-secondary">
                <UserLink actor={actor} />
                {added.length > 0 && (
                    <>
                        {" added "}
                        {added.map((c, i) => (
                            <span key={c.label.name}>
                                {i > 0 && i === added.length - 1 ? " and " : ""}
                                <Label
                                    color={c.label.color}
                                    description={
                                        c.label.description ?? undefined
                                    }
                                >
                                    {c.label.name}
                                </Label>
                            </span>
                        ))}
                    </>
                )}
                {added.length > 0 && removed.length > 0 && " and "}
                {removed.length > 0 && (
                    <>
                        {" removed "}
                        {removed.map((c, i) => (
                            <span key={c.label.name}>
                                {i > 0 && i === removed.length - 1
                                    ? " and "
                                    : ""}
                                <Label
                                    color={c.label.color}
                                    description={
                                        c.label.description ?? undefined
                                    }
                                >
                                    {c.label.name}
                                </Label>
                            </span>
                        ))}
                    </>
                )}
                <span
                    title={fullDate}
                >{` ${total === 1 ? "label" : "labels"} ${timestamp}`}</span>
            </div>
        </div>
    );
}

const ICON_SIZE = 16;

export function EventRow({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-1 text-sm text-text-secondary">
            {children}
        </div>
    );
}

function TimelineIcon({ event }: { event: GQLTimelineEvent }) {
    if (event.__typename === "IssueComment" && event.author) {
        return (
            <UserHoverCard login={event.author.login} provider="gh">
                <a
                    className="absolute -left-[52px] h-10 w-10 overflow-hidden rounded-full ring-1 ring-border"
                    href={event.author.url}
                >
                    <Image
                        alt={event.author.login}
                        className="h-10 w-10 rounded-full"
                        src={event.author.avatarUrl}
                        width={40}
                        height={40}
                    />
                </a>
            </UserHoverCard>
        );
    }

    const iconMap: Record<string, React.ReactNode> = {
        PullRequestReview: <Eye size={ICON_SIZE} />,
        ClosedEvent: (
            <GitPullRequestClosed className="text-white" size={ICON_SIZE} />
        ),
        ReopenedEvent: (
            <GitPullRequestArrow className="text-white" size={ICON_SIZE} />
        ),
        MergedEvent: <GitMerge className="text-white" size={ICON_SIZE} />,
        LabeledEvent: <Tag size={ICON_SIZE} />,
        UnlabeledEvent: <Tag size={ICON_SIZE} />,
        AssignedEvent: <User size={ICON_SIZE} />,
        BaseRefChangedEvent: <GitBranch size={ICON_SIZE} />,
        UnassignedEvent: <User size={ICON_SIZE} />,
        ReviewRequestedEvent: <ClipboardList size={ICON_SIZE} />,
        ReviewRequestRemovedEvent: <ClipboardList size={ICON_SIZE} />,
        PullRequestCommit: <GitCommitHorizontal size={ICON_SIZE} />,
        RenamedTitleEvent: <Pencil size={ICON_SIZE} />,
        LockedEvent: <Lock size={ICON_SIZE} />,
        UnlockedEvent: <LockOpen size={ICON_SIZE} />,
        MilestonedEvent: <Target size={ICON_SIZE} />,
        DemilestonedEvent: <Target size={ICON_SIZE} />,
        CrossReferencedEvent: <Link size={ICON_SIZE} />,
        ReferencedEvent: <Link size={ICON_SIZE} />,
        HeadRefDeletedEvent: <Trash2 size={ICON_SIZE} />,
        HeadRefRestoredEvent: <RefreshCw size={ICON_SIZE} />,
        ConvertToDraftEvent: <FileText size={ICON_SIZE} />,
        ReadyForReviewEvent: <CheckCheck size={ICON_SIZE} />,
        HeadRefForcePushedEvent: <ArrowUp size={ICON_SIZE} />,
        AddedToProjectV2Event: <ClipboardList size={ICON_SIZE} />,
        ProjectV2ItemStatusChangedEvent: <RefreshCw size={ICON_SIZE} />,
        DeployedEvent: <Rocket className="text-blue-500" size={ICON_SIZE} />,
        AutoMergeEnabledEvent: (
            <ListOrdered className="text-blue-500" size={ICON_SIZE} />
        ),
        AutoMergeDisabledEvent: (
            <X className="text-state-closed" size={ICON_SIZE} />
        ),
        AddedToMergeQueueEvent: (
            <Clock className="text-state-queued" size={ICON_SIZE} />
        ),
        RemovedFromMergeQueueEvent: (
            <X className="text-state-closed" size={ICON_SIZE} />
        ),
        ReviewDismissedEvent: (
            <X className="text-state-closed" size={ICON_SIZE} />
        ),
    };

    const typename = event.__typename;
    const isApproved =
        typename === "PullRequestReview" && event.state === "APPROVED";
    const isChangesRequested =
        typename === "PullRequestReview" && event.state === "CHANGES_REQUESTED";
    const isMerged = typename === "MergedEvent";
    const isClosed = typename === "ClosedEvent";
    const isReopened = typename === "ReopenedEvent";

    const circleClass = isApproved
        ? approvalHasWriteAccess(event.authorPermission)
            ? "absolute -left-12 flex h-7 w-7 items-center justify-center rounded-full bg-state-open"
            : "absolute -left-12 flex h-7 w-7 items-center justify-center rounded-full bg-surface ring-1 ring-border"
        : isChangesRequested
          ? "absolute -left-12 flex h-7 w-7 items-center justify-center rounded-full bg-state-closed"
          : isClosed
            ? "absolute -left-12 flex h-7 w-7 items-center justify-center rounded-full bg-state-closed"
            : isReopened
              ? "absolute -left-12 flex h-7 w-7 items-center justify-center rounded-full bg-state-open"
              : isMerged
                ? "absolute -left-12 flex h-7 w-7 items-center justify-center rounded-full bg-state-merged"
                : "absolute -left-12 flex h-7 w-7 items-center justify-center rounded-full bg-surface ring-1 ring-border";

    let icon = iconMap[typename] ?? <Circle size={ICON_SIZE} />;

    if (typename === "PullRequestReview") {
        if (event.state === "APPROVED") {
            icon = approvalHasWriteAccess(event.authorPermission) ? (
                <Check className="text-white" size={ICON_SIZE} />
            ) : (
                <Check className="text-text-muted" size={ICON_SIZE} />
            );
        }
        if (event.state === "CHANGES_REQUESTED")
            icon = <FileText className="text-white" size={ICON_SIZE} />;
    }

    return (
        <div className={circleClass}>
            <span className="flex">{icon}</span>
        </div>
    );
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: FIXME: cleanup the complex mutations
function EventContent({
    event,
    owner,
    repo,
    number,
    commentReactions,
    allComments,
    permissionContext,
}: {
    event: GQLTimelineEvent;
    owner: string;
    repo: string;
    number: number;
    commentReactions: Record<string, GQLReactionNode[]>;
    allComments: ReviewComment[];
    permissionContext: PullRequestPermissionContext;
}) {
    const [editingCommentId, setEditingCommentId] = useState<number | null>(
        null,
    );
    const [editBody, setEditBody] = useState("");
    const [savedBodies, setSavedBodies] = useState<Record<number, string>>({});
    const [expandedMinimized, setExpandedMinimized] = useState<
        Record<number, boolean>
    >({});

    const utils = api.useUtils();

    const updateCommentMutation = api.pulls.updateComment.useMutation({
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

    const updateReviewMutation = api.pulls.updateReview.useMutation({
        onMutate: ({ reviewId, body }) => {
            setSavedBodies((prev) => ({ ...prev, [reviewId]: body }));
            setEditingCommentId(null);
        },
        onError: (_, { reviewId }) => {
            setSavedBodies((prev) => {
                const next = { ...prev };
                delete next[reviewId];
                return next;
            });
            setEditingCommentId(reviewId);
        },
    });
    // Task-list checkbox toggles. Separate mutations from the edit flow so
    // their onMutate/onError contract mirrors the toggle flow (optimistic body
    // overlay, no edit-mode transitions) while sharing `savedBodies`.
    const commentTaskToggleMutation = api.pulls.updateComment.useMutation({
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

    const reviewTaskToggleMutation = api.pulls.updateReview.useMutation({
        onMutate: ({ reviewId, body }) => {
            setSavedBodies((prev) => ({ ...prev, [reviewId]: body }));
        },
        onError: (_, { reviewId }) => {
            setSavedBodies((prev) => {
                const next = { ...prev };
                delete next[reviewId];
                return next;
            });
        },
    });

    const deleteCommentMutation = api.pulls.deleteComment.useMutation({
        onMutate: async ({ commentId }) => {
            await utils.timeline.list.cancel({
                owner,
                repo,
                number,
                limit: TIMELINE_PAGE_SIZE,
            });

            const prevData = utils.timeline.list.getInfiniteData({
                owner,
                repo,
                number,
                limit: TIMELINE_PAGE_SIZE,
            });

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
                                    event.__typename !== "IssueComment" ||
                                    event.databaseId !== commentId,
                            ),
                        })),
                    };
                },
            );

            return { prevData };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prevData) {
                utils.timeline.list.setInfiniteData(
                    { owner, repo, number, limit: TIMELINE_PAGE_SIZE },
                    ctx.prevData,
                );
            }
        },
        onSettled: () => {
            utils.timeline.list.invalidate({
                owner,
                repo,
                number,
                limit: TIMELINE_PAGE_SIZE,
            });
        },
    });

    const commentReactionMutation =
        api.reactions.toggleIssueComment.useMutation({
            onMutate: async ({ commentId, content }) => {
                const user = permissionContext.currentUser;
                if (!user) {
                    return;
                }
                await utils.timeline.list.cancel();

                const prevData = utils.timeline.list.getInfiniteData({
                    owner,
                    repo,
                    number,
                    limit: TIMELINE_PAGE_SIZE,
                });

                utils.timeline.list.setInfiniteData(
                    { owner, repo, number, limit: TIMELINE_PAGE_SIZE },
                    (old) => {
                        if (!old) return old;
                        return {
                            ...old,
                            pages: old.pages.map((page) => {
                                const key = `comment:${commentId}`;
                                if (!(key in page.commentReactions)) {
                                    return page;
                                }
                                return {
                                    ...page,
                                    commentReactions: {
                                        ...page.commentReactions,
                                        [key]: toggleReactionInList(
                                            page.commentReactions[key] ?? [],
                                            user,
                                            content,
                                        ),
                                    },
                                };
                            }),
                        };
                    },
                );

                return { prevData };
            },
            onError: (_err, _vars, ctx) => {
                if (ctx?.prevData) {
                    utils.timeline.list.setInfiniteData(
                        { owner, repo, number, limit: TIMELINE_PAGE_SIZE },
                        ctx.prevData,
                    );
                }
            },
            onSettled: () => {
                utils.timeline.list.invalidate({
                    owner,
                    repo,
                    number,
                    limit: TIMELINE_PAGE_SIZE,
                });
            },
        });

    const reviewReactionMutation =
        api.reactions.togglePullRequestReview.useMutation({
            onMutate: async ({ content, databaseId }) => {
                const user = permissionContext.currentUser;
                if (!user) {
                    return;
                }
                await utils.timeline.list.cancel({
                    owner,
                    repo,
                    number,
                    limit: TIMELINE_PAGE_SIZE,
                });

                const prevData = utils.timeline.list.getInfiniteData({
                    owner,
                    repo,
                    number,
                    limit: TIMELINE_PAGE_SIZE,
                });

                utils.timeline.list.setInfiniteData(
                    { owner, repo, number, limit: TIMELINE_PAGE_SIZE },
                    (old) => {
                        if (!old || !databaseId) return old;
                        return {
                            ...old,
                            pages: old.pages.map((page) => {
                                const key = `review:${databaseId}`;
                                if (!(key in page.commentReactions)) {
                                    return page;
                                }
                                return {
                                    ...page,
                                    commentReactions: {
                                        ...page.commentReactions,
                                        [key]: toggleReactionInList(
                                            page.commentReactions[key] ?? [],
                                            user,
                                            content,
                                        ),
                                    },
                                };
                            }),
                        };
                    },
                );

                return { prevData };
            },
            onError: (_err, _vars, ctx) => {
                if (ctx?.prevData) {
                    utils.timeline.list.setInfiniteData(
                        { owner, repo, number, limit: TIMELINE_PAGE_SIZE },
                        ctx.prevData,
                    );
                }
            },
            onSettled: () => {
                utils.timeline.list.invalidate({
                    owner,
                    repo,
                    number,
                    limit: TIMELINE_PAGE_SIZE,
                });
            },
        });

    const handleSaveComment = (commentId: number, body: string) => {
        updateCommentMutation.mutate({ owner, repo, commentId, body });
    };

    const handleSaveReview = (reviewId: number, body: string) => {
        updateReviewMutation.mutate({ owner, repo, number, reviewId, body });
    };

    const handleDeleteComment = (commentId: number) => {
        deleteCommentMutation.mutate({ owner, repo, commentId });
    };

    const handleCommentReaction = (
        commentId: number,
        content: ReactionContent,
    ) => {
        commentReactionMutation.mutate({ owner, repo, commentId, content });
    };

    const handleReviewReaction = (
        subjectId: string,
        databaseId: number,
        content: ReactionContent,
    ) => {
        reviewReactionMutation.mutate({ subjectId, content, databaseId });
    };

    const handleToggleMinimized = (commentId: number, expanded: boolean) => {
        setExpandedMinimized((prev) => ({
            ...prev,
            [commentId]: expanded,
        }));
    };

    const baseProps = { owner, repo, permissionContext };

    switch (event.__typename) {
        case "IssueComment":
            return (
                <IssueCommentContent
                    event={event}
                    {...baseProps}
                    commentReactions={commentReactions}
                    editingCommentId={editingCommentId}
                    editBody={editBody}
                    savedBodies={savedBodies}
                    expandedMinimized={expandedMinimized}
                    onEditBodyChange={setEditBody}
                    onStartEdit={(id, body) => {
                        setEditBody(body);
                        setEditingCommentId(id);
                    }}
                    onCancelEdit={() => setEditingCommentId(null)}
                    onSaveEdit={handleSaveComment}
                    onDelete={handleDeleteComment}
                    onReactToComment={handleCommentReaction}
                    onToggleMinimized={handleToggleMinimized}
                    commentToggleMutation={{
                        mutate: commentTaskToggleMutation.mutate,
                        isPending: commentTaskToggleMutation.isPending,
                    }}
                />
            );

        case "PullRequestReview":
            return (
                <PullRequestReviewContent
                    event={event}
                    {...baseProps}
                    number={number}
                    allComments={allComments}
                    commentReactions={commentReactions}
                    editingCommentId={editingCommentId}
                    editBody={editBody}
                    savedBodies={savedBodies}
                    onEditBodyChange={setEditBody}
                    onStartEdit={(id, body) => {
                        setEditBody(body);
                        setEditingCommentId(id);
                    }}
                    onCancelEdit={() => setEditingCommentId(null)}
                    onSaveEdit={handleSaveReview}
                    onReactToReview={handleReviewReaction}
                    expandedMinimized={expandedMinimized}
                    onToggleMinimized={handleToggleMinimized}
                    reviewToggleMutation={{
                        mutate: reviewTaskToggleMutation.mutate,
                        isPending: reviewTaskToggleMutation.isPending,
                    }}
                />
            );

        case "PullRequestCommit":
            return (
                <PullRequestCommitContent
                    event={event}
                    owner={owner}
                    repo={repo}
                    number={number}
                />
            );

        case "ReviewDismissedEvent":
            return <ReviewDismissedContent event={event} />;

        case "HeadRefForcePushedEvent":
            return (
                <HeadRefForcePushContent
                    event={event}
                    owner={owner}
                    repo={repo}
                    number={number}
                />
            );

        case "ReferencedEvent":
            return <ReferencedEventContent event={event} />;

        case "HeadRefDeletedEvent":
        case "HeadRefRestoredEvent":
            return <HeadRefEventContent event={event} />;

        case "CrossReferencedEvent":
            return (
                <CrossReferencedEventContent
                    event={event}
                    owner={owner}
                    repo={repo}
                />
            );

        case "AssignedEvent":
        case "UnassignedEvent":
            return <AssignedEventContent event={event} />;

        case "BaseRefChangedEvent":
            return <BaseRefChangedContent event={event} />;

        case "MergedEvent":
            return (
                <MergedEventContent event={event} owner={owner} repo={repo} />
            );

        case "ClosedEvent":
        case "ReopenedEvent":
        case "ConvertToDraftEvent":
        case "ReadyForReviewEvent":
            return <StateEventContent event={event} />;

        case "RenamedTitleEvent":
            return <RenamedTitleContent event={event} />;

        case "MilestonedEvent":
        case "DemilestonedEvent":
            return <MilestoneEventContent event={event} />;

        case "LockedEvent":
        case "UnlockedEvent":
            return <LockedEventContent event={event} />;

        case "ReviewRequestedEvent":
        case "ReviewRequestRemovedEvent":
            return <ReviewRequestEventContent event={event} />;

        case "AddedToProjectV2Event":
        case "ProjectV2ItemStatusChangedEvent":
            return <ProjectEventContent event={event} />;

        case "DeployedEvent":
            return <DeployedEventContent event={event} />;

        case "AutoMergeEnabledEvent":
        case "AutoMergeDisabledEvent":
            return <AutoMergeEventContent event={event} />;

        case "AddedToMergeQueueEvent":
        case "RemovedFromMergeQueueEvent":
            return <MergeQueueEventContent event={event} />;

        default:
            console.warn(`unknown event type: ${event.__typename}`, event);
            return null;
    }
}
