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
import { formatRelativeTime } from "~/utils";
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
    commentReactions: Record<number, GQLReactionNode[]>;
    currentUserLogin: string;
    allComments: ReviewComment[];
    canInteract: boolean;
}

export function TimelineEvent({
    wrapper,
    owner,
    repo,
    number,
    commentReactions,
    currentUserLogin,
    allComments,
    canInteract,
}: TimelineEventProps) {
    if (wrapper.type === "aggregated-label") {
        return <AggregatedLabel wrapper={wrapper} />;
    }

    return (
        <div className="relative mb-8 ml-14">
            <TimelineIcon event={wrapper.event} />

            <div className="pt-1">
                <EventContent
                    event={wrapper.event}
                    owner={owner}
                    repo={repo}
                    number={number}
                    commentReactions={commentReactions}
                    currentUserLogin={currentUserLogin}
                    allComments={allComments}
                    canInteract={canInteract}
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
    const added = changes.filter((c) => c.event === "labeled");
    const removed = changes.filter((c) => c.event === "unlabeled");
    const total = changes.length;

    return (
        <div className="relative mb-8 ml-14">
            <div className="absolute -left-12 flex h-8 w-8 items-center justify-center rounded-full bg-white ring-1 ring-gray-200 dark:bg-zinc-950 dark:ring-zinc-700">
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
                <span>{` ${total === 1 ? "label" : "labels"} ${timestamp}`}</span>
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
                    className="absolute -left-[52px] h-10 w-10 overflow-hidden rounded-full ring-1 ring-gray-200 dark:ring-zinc-700"
                    href={event.author.url}
                >
                    <img
                        alt={event.author.login}
                        className="h-10 w-10 rounded-full"
                        src={event.author.avatarUrl}
                    />
                </a>
            </UserHoverCard>
        );
    }

    const iconMap: Record<string, React.ReactNode> = {
        PullRequestReview: <Eye size={ICON_SIZE} />,
        ClosedEvent: (
            <Circle className="fill-red-500/20 text-red-500" size={ICON_SIZE} />
        ),
        ReopenedEvent: (
            <Circle
                className="fill-green-500/20 text-green-500"
                size={ICON_SIZE}
            />
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
        AutoMergeDisabledEvent: <X className="text-red-400" size={ICON_SIZE} />,
        AddedToMergeQueueEvent: <Clock size={ICON_SIZE} />,
        RemovedFromMergeQueueEvent: (
            <X className="text-red-400" size={ICON_SIZE} />
        ),
    };

    const typename = event.__typename;
    const isApproved =
        typename === "PullRequestReview" && event.state === "APPROVED";
    const isChangesRequested =
        typename === "PullRequestReview" && event.state === "CHANGES_REQUESTED";
    const isMerged = typename === "MergedEvent";

    const circleClass = isApproved
        ? "absolute -left-12 flex h-7 w-7 items-center justify-center rounded-full bg-green-500"
        : isChangesRequested
          ? "absolute -left-12 flex h-7 w-7 items-center justify-center rounded-full bg-red-500"
          : isMerged
            ? "absolute -left-12 flex h-7 w-7 items-center justify-center rounded-full bg-purple-500"
            : "absolute -left-12 flex h-7 w-7 items-center justify-center rounded-full bg-white ring-1 ring-gray-200 dark:bg-zinc-950 dark:ring-zinc-700";

    let icon = iconMap[typename] ?? <Circle size={ICON_SIZE} />;

    if (typename === "PullRequestReview") {
        if (event.state === "APPROVED")
            icon = <Check className="text-white" size={ICON_SIZE} />;
        if (event.state === "CHANGES_REQUESTED")
            icon = <FileText className="text-white" size={ICON_SIZE} />;
    }

    return (
        <div className={circleClass}>
            <span className="flex">{icon}</span>
        </div>
    );
}

function EventContent({
    event,
    owner,
    repo,
    number,
    commentReactions,
    currentUserLogin,
    allComments,
    canInteract,
}: {
    event: GQLTimelineEvent;
    owner: string;
    repo: string;
    number: number;
    commentReactions: Record<number, GQLReactionNode[]>;
    currentUserLogin: string;
    allComments: ReviewComment[];
    canInteract: boolean;
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

    const commentReactionMutation =
        api.reactions.toggleIssueComment.useMutation({
            onMutate: async ({ commentId, content }) => {
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
                                if (!(commentId in page.commentReactions)) {
                                    return page;
                                }
                                return {
                                    ...page,
                                    commentReactions: {
                                        ...page.commentReactions,
                                        [commentId]: toggleReactionInList(
                                            page.commentReactions[commentId] ??
                                                [],
                                            currentUserLogin,
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
                                if (!(databaseId in page.commentReactions)) {
                                    return page;
                                }
                                return {
                                    ...page,
                                    commentReactions: {
                                        ...page.commentReactions,
                                        [databaseId]: toggleReactionInList(
                                            page.commentReactions[databaseId] ??
                                                [],
                                            currentUserLogin,
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

    const baseProps = { owner, repo, currentUserLogin, canInteract };

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
                    onReactToComment={handleCommentReaction}
                    onToggleMinimized={handleToggleMinimized}
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
            return <CrossReferencedEventContent event={event} />;

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
