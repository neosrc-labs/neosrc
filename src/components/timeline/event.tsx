"use client";

import {
    Archive,
    ArchiveRestore,
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
import type { PullRequestPermissionContext } from "~/components/permissions/permissions-utils";
import { Label } from "~/components/ui/label";
import { UserLink } from "~/components/user/user-link";
import type { ReviewComment } from "~/server/github";
import type {
    GQLReactionNode,
    GQLTimelineEvent,
} from "~/server/github-graphql";
import { formatDateTime, formatRelativeTime } from "~/utils/format-time";
import type { Provider } from "~/utils/provider-url";
import type { ReactionContent } from "~/utils/reactions";
import { ArchiveEventContent } from "./content/archive-event";
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
import {
    useCommentTaskToggle,
    useDeleteTimelineComment,
    useIssueCommentReactionToggle,
    usePullRequestReviewReactionToggle,
    useReviewTaskToggle,
    useSavedBodies,
    useUpdateCommentBody,
    useUpdateReviewBody,
} from "./use-timeline-comment-actions";
import { approvalHasWriteAccess } from "./utils";

export const formatReason = (reason: string) =>
    reason
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

interface TimelineEventProps {
    wrapper: TimelineWrapper;
    provider: Provider;
    owner: string;
    repo: string;
    number: number;
    commentReactions: Record<string, GQLReactionNode[]>;
    allComments: ReviewComment[];
    permissionContext: PullRequestPermissionContext;
    issueNumber?: number;
}

export function TimelineEvent({
    wrapper,
    provider,
    owner,
    repo,
    number,
    commentReactions,
    allComments,
    permissionContext,
    issueNumber,
}: TimelineEventProps) {
    if (wrapper.type === "aggregated-label") {
        return <AggregatedLabel wrapper={wrapper} provider={provider} />;
    }

    return (
        <div className="relative mb-8 ml-14">
            <TimelineIcon
                event={wrapper.event}
                provider={provider}
                isIssue={issueNumber !== undefined}
            />

            <div
                // Paint containment clips comment tails and highlight shadows.
                // Padding contains the tails; the clip margin preserves shadows.
                className="-ml-2 pt-1 pl-2"
                style={{
                    contentVisibility: "auto",
                    containIntrinsicSize: "200px",
                    overflowClipMargin: "8px",
                }}
            >
                <EventContent
                    event={wrapper.event}
                    provider={provider}
                    owner={owner}
                    repo={repo}
                    number={number}
                    commentReactions={commentReactions}
                    allComments={allComments}
                    permissionContext={permissionContext}
                    issueNumber={issueNumber}
                />
            </div>
        </div>
    );
}

export function TimelineEventList({
    wrappers,
    provider,
    owner,
    repo,
    number,
    commentReactions,
    allComments,
    permissionContext,
    issueNumber,
    isFetchingNextPage,
}: {
    wrappers: TimelineWrapper[];
    provider: Provider;
    owner: string;
    repo: string;
    number: number;
    commentReactions: Record<string, GQLReactionNode[]>;
    allComments: ReviewComment[];
    permissionContext: PullRequestPermissionContext;
    issueNumber?: number;
    isFetchingNextPage: boolean;
}) {
    return (
        <>
            {wrappers.length === 0 && (
                <p className="text-sm text-text-tertiary">
                    No timeline events yet.
                </p>
            )}

            <div className="relative">
                <div className="absolute top-0 bottom-0 left-6 w-px bg-surface-selected" />

                {wrappers.map((wrapper) => (
                    <TimelineEvent
                        key={
                            wrapper.type === "raw"
                                ? `raw-${wrapper.event.id}`
                                : `label-${wrapper.createdAt}`
                        }
                        wrapper={wrapper}
                        provider={provider}
                        number={number}
                        owner={owner}
                        repo={repo}
                        commentReactions={commentReactions}
                        allComments={allComments}
                        permissionContext={permissionContext}
                        issueNumber={issueNumber}
                    />
                ))}
            </div>

            {isFetchingNextPage && (
                <div className="py-4 text-center">
                    <p className="text-sm text-text-tertiary">
                        Loading more...
                    </p>
                </div>
            )}
        </>
    );
}

function AggregatedLabel({
    wrapper,
    provider,
}: {
    wrapper: Extract<TimelineWrapper, { type: "aggregated-label" }>;
    provider: Provider;
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
            <div className="flex min-h-8 flex-wrap items-center gap-1.5 text-sm text-text-secondary">
                <UserLink actor={actor} provider={provider} />
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
        <div className="flex items-start gap-1 text-sm text-text-secondary">
            {children}
        </div>
    );
}

function IssueCompletedTimelineIcon() {
    return (
        <svg
            aria-hidden="true"
            className="size-4 fill-current"
            viewBox="0 0 16 16"
        >
            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm1.5 0a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm10.28-1.72-4.5 4.5a.75.75 0 0 1-1.06 0l-2-2a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018l1.47 1.47 3.97-3.97a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z" />
        </svg>
    );
}

function IssueInactiveTimelineIcon() {
    return (
        <svg
            aria-hidden="true"
            className="size-4 fill-current"
            viewBox="0 0 16 16"
        >
            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM3.965 13.096a6.5 6.5 0 0 0 9.131-9.131ZM1.5 8a6.474 6.474 0 0 0 1.404 4.035l9.131-9.131A6.499 6.499 0 0 0 1.5 8Z" />
        </svg>
    );
}

function IssueReopenedTimelineIcon() {
    return (
        <svg
            aria-hidden="true"
            className="size-4 fill-current"
            viewBox="0 0 16 16"
        >
            <path d="M5.029 2.217a6.5 6.5 0 0 1 9.437 5.11.75.75 0 1 0 1.492-.154 8 8 0 0 0-14.315-4.03L.427 1.927A.25.25 0 0 0 0 2.104V5.75A.25.25 0 0 0 .25 6h3.646a.25.25 0 0 0 .177-.427L2.715 4.215a6.491 6.491 0 0 1 2.314-1.998ZM1.262 8.169a.75.75 0 0 0-1.22.658 8.001 8.001 0 0 0 14.315 4.03l1.216 1.216a.25.25 0 0 0 .427-.177V10.25a.25.25 0 0 0-.25-.25h-3.646a.25.25 0 0 0-.177.427l1.358 1.358a6.501 6.501 0 0 1-11.751-3.11.75.75 0 0 0-.272-.506Z" />
            <path d="M9.06 9.06a1.5 1.5 0 1 1-2.12-2.12 1.5 1.5 0 0 1 2.12 2.12Z" />
        </svg>
    );
}

function TimelineIcon({
    event,
    provider,
    isIssue,
}: {
    event: GQLTimelineEvent;
    provider: Provider;
    isIssue: boolean;
}) {
    if (event.__typename === "IssueComment" && event.author) {
        return (
            <UserHoverCard login={event.author.login} provider={provider}>
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

    const closedReason =
        event.__typename === "ClosedEvent" ? event.stateReason : null;
    const isInactiveIssueClose =
        isIssue &&
        (closedReason === "NOT_PLANNED" || closedReason === "DUPLICATE");

    const iconMap: Record<string, React.ReactNode> = {
        PullRequestReview: <Eye size={ICON_SIZE} />,
        ClosedEvent: isIssue ? (
            isInactiveIssueClose ? (
                <IssueInactiveTimelineIcon />
            ) : (
                <IssueCompletedTimelineIcon />
            )
        ) : (
            <GitPullRequestClosed
                className="text-state-solid-foreground"
                size={ICON_SIZE}
            />
        ),
        ReopenedEvent: isIssue ? (
            <IssueReopenedTimelineIcon />
        ) : (
            <GitPullRequestArrow
                className="text-state-solid-foreground"
                size={ICON_SIZE}
            />
        ),
        MergedEvent: (
            <GitMerge
                className="text-state-solid-foreground"
                size={ICON_SIZE}
            />
        ),
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
        ArchivedEvent: <Archive size={ICON_SIZE} />,
        UnarchivedEvent: <ArchiveRestore size={ICON_SIZE} />,
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
        DeployedEvent: (
            <Rocket className="text-info-emphasis" size={ICON_SIZE} />
        ),
        AutoMergeEnabledEvent: <GitPullRequestArrow size={ICON_SIZE} />,
        AutoSquashEnabledEvent: <GitPullRequestArrow size={ICON_SIZE} />,
        AutoRebaseEnabledEvent: <GitPullRequestArrow size={ICON_SIZE} />,
        AutoMergeDisabledEvent: <GitPullRequestArrow size={ICON_SIZE} />,
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

    const circleBase =
        "absolute -left-12 flex h-7 w-7 items-center justify-center rounded-full";
    let circleStyle = "bg-surface ring-1 ring-border";
    if (isApproved) {
        if (approvalHasWriteAccess(event.authorPermission)) {
            circleStyle = "bg-state-open-solid";
        }
    } else if (isChangesRequested) {
        circleStyle = "bg-state-closed-solid";
    } else if (isClosed) {
        if (!isIssue) {
            circleStyle = "bg-state-closed-solid";
        } else if (isInactiveIssueClose) {
            circleStyle = "bg-state-issue-inactive text-state-solid-foreground";
        } else {
            circleStyle =
                "bg-state-issue-completed text-state-solid-foreground";
        }
    } else if (isReopened) {
        circleStyle = isIssue
            ? "bg-state-issue-open text-state-solid-foreground"
            : "bg-state-open-solid";
    } else if (isMerged) {
        circleStyle = "bg-state-merged-solid";
    }
    const circleClass = `${circleBase} ${circleStyle}`;

    let icon = iconMap[typename] ?? <Circle size={ICON_SIZE} />;

    if (typename === "PullRequestReview") {
        if (event.state === "APPROVED") {
            icon = approvalHasWriteAccess(event.authorPermission) ? (
                <Check
                    className="text-state-solid-foreground"
                    size={ICON_SIZE}
                />
            ) : (
                <Check className="text-text-muted" size={ICON_SIZE} />
            );
        }
        if (event.state === "CHANGES_REQUESTED")
            icon = (
                <FileText
                    className="text-state-solid-foreground"
                    size={ICON_SIZE}
                />
            );
    }

    return (
        <div className={circleClass}>
            <span className="flex">{icon}</span>
        </div>
    );
}

function EventContent({
    event,
    provider,
    owner,
    repo,
    number,
    commentReactions,
    allComments,
    permissionContext,
    issueNumber,
}: {
    event: GQLTimelineEvent;
    provider: Provider;
    owner: string;
    repo: string;
    number: number;
    commentReactions: Record<string, GQLReactionNode[]>;
    allComments: ReviewComment[];
    permissionContext: PullRequestPermissionContext;
    issueNumber?: number;
}) {
    const [editingCommentId, setEditingCommentId] = useState<number | null>(
        null,
    );
    const [editBody, setEditBody] = useState("");
    const [expandedMinimized, setExpandedMinimized] = useState<
        Record<number, boolean>
    >({});

    const savedBodiesStore = useSavedBodies();
    const editTransitions = {
        onSaved: () => setEditingCommentId(null),
        onResumeEdit: (id: number) => setEditingCommentId(id),
    };

    const updateCommentMutation = useUpdateCommentBody(
        savedBodiesStore,
        editTransitions,
    );
    const updateReviewMutation = useUpdateReviewBody(
        savedBodiesStore,
        editTransitions,
    );
    // Task-list checkbox toggles share the optimistic body overlay but
    // never touch editor state.
    const commentTaskToggleMutation = useCommentTaskToggle(savedBodiesStore);
    const reviewTaskToggleMutation = useReviewTaskToggle(savedBodiesStore);

    const timelineScope =
        issueNumber !== undefined
            ? { provider, owner, repo, issueNumber }
            : { owner, repo, number };

    const deleteCommentMutation = useDeleteTimelineComment(timelineScope);

    const commentReactionMutation = useIssueCommentReactionToggle(
        timelineScope,
        permissionContext.currentUser,
    );

    const reviewReactionMutation = usePullRequestReviewReactionToggle(
        { owner, repo, number },
        permissionContext.currentUser,
    );

    const handleSaveComment = (commentId: number, body: string) => {
        updateCommentMutation.mutate({
            provider,
            owner,
            repo,
            commentId,
            body,
        });
    };

    const handleSaveReview = (reviewId: number, body: string) => {
        updateReviewMutation.mutate({ owner, repo, number, reviewId, body });
    };

    const handleDeleteComment = (commentId: number) => {
        deleteCommentMutation.mutate({ provider, owner, repo, commentId });
    };

    const handleCommentReaction = (
        commentId: number,
        content: ReactionContent,
    ) => {
        commentReactionMutation.mutate({
            provider,
            owner,
            repo,
            commentId,
            content,
        });
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

    const baseProps = { provider, owner, repo, number, permissionContext };

    switch (event.__typename) {
        case "IssueComment":
            return (
                <IssueCommentContent
                    event={event}
                    {...baseProps}
                    commentReactions={commentReactions}
                    editingCommentId={editingCommentId}
                    editBody={editBody}
                    savedBodies={savedBodiesStore.savedBodies}
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
                    allComments={allComments}
                    commentReactions={commentReactions}
                    editingCommentId={editingCommentId}
                    editBody={editBody}
                    savedBodies={savedBodiesStore.savedBodies}
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
                    provider={provider}
                    owner={owner}
                    repo={repo}
                    number={number}
                />
            );

        case "ReviewDismissedEvent":
            return <ReviewDismissedContent event={event} provider={provider} />;

        case "HeadRefForcePushedEvent":
            return (
                <HeadRefForcePushContent
                    event={event}
                    provider={provider}
                    owner={owner}
                    repo={repo}
                    number={number}
                />
            );

        case "ReferencedEvent":
            return <ReferencedEventContent event={event} provider={provider} />;

        case "HeadRefDeletedEvent":
        case "HeadRefRestoredEvent":
            return <HeadRefEventContent event={event} provider={provider} />;

        case "CrossReferencedEvent":
            return (
                <CrossReferencedEventContent
                    event={event}
                    provider={provider}
                    owner={owner}
                    repo={repo}
                />
            );

        case "AssignedEvent":
        case "UnassignedEvent":
            return <AssignedEventContent event={event} provider={provider} />;

        case "BaseRefChangedEvent":
            return <BaseRefChangedContent event={event} provider={provider} />;

        case "MergedEvent":
            return (
                <MergedEventContent
                    event={event}
                    provider={provider}
                    owner={owner}
                    repo={repo}
                />
            );

        case "ClosedEvent":
        case "ReopenedEvent":
        case "ConvertToDraftEvent":
        case "ReadyForReviewEvent":
            return <StateEventContent event={event} provider={provider} />;

        case "RenamedTitleEvent":
            return <RenamedTitleContent event={event} provider={provider} />;

        case "MilestonedEvent":
        case "DemilestonedEvent":
            return <MilestoneEventContent event={event} provider={provider} />;

        case "LockedEvent":
        case "UnlockedEvent":
            return <LockedEventContent event={event} provider={provider} />;

        case "ArchivedEvent":
        case "UnarchivedEvent":
            return <ArchiveEventContent event={event} provider={provider} />;

        case "ReviewRequestedEvent":
        case "ReviewRequestRemovedEvent":
            return (
                <ReviewRequestEventContent event={event} provider={provider} />
            );

        case "AddedToProjectV2Event":
        case "ProjectV2ItemStatusChangedEvent":
            return <ProjectEventContent event={event} provider={provider} />;

        case "DeployedEvent":
            return <DeployedEventContent event={event} provider={provider} />;

        case "AutoMergeEnabledEvent":
        case "AutoSquashEnabledEvent":
        case "AutoRebaseEnabledEvent":
        case "AutoMergeDisabledEvent":
            return <AutoMergeEventContent event={event} provider={provider} />;

        case "AddedToMergeQueueEvent":
        case "RemovedFromMergeQueueEvent":
            return <MergeQueueEventContent event={event} provider={provider} />;

        default:
            console.warn(`unknown event type: ${event.__typename}`, event);
            return null;
    }
}
