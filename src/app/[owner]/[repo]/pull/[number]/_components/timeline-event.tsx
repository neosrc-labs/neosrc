"use client";

import {
    ArrowUp,
    Check,
    CheckCheck,
    ChevronDown,
    Circle,
    ClipboardList,
    Eye,
    FileText,
    GitBranch,
    GitCommitHorizontal,
    GitMerge,
    Link,
    Lock,
    LockOpen,
    MessageSquare,
    Pencil,
    RefreshCw,
    Rocket,
    SquarePen,
    Tag,
    Target,
    Trash2,
    User,
} from "lucide-react";
import NextLink from "next/link";
import { useState } from "react";
import { CommentCard } from "~/components/CommentCard";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import { MarkdownRenderer } from "~/components/markdown/MarkdownRenderer";
import { ReactionBar } from "~/components/ReactionBar";
import { ReactionPicker } from "~/components/ReactionPicker";
import { Label } from "~/components/ui/label";
import { UserLink } from "~/components/user-link";
import { VerifiedBadge } from "~/components/verified-badge";
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
import { ReviewComments } from "./review-comments";
import type { TimelineWrapper } from "./timeline-types";

const formatReason = (reason: string) =>
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
            <div className="flex flex-wrap items-center gap-1.5 text-gray-600 text-sm dark:text-zinc-400">
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

function EventRow({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-1 text-gray-600 text-sm dark:text-zinc-400">
            {children}
        </div>
    );
}

function TimelineIcon({ event }: { event: GQLTimelineEvent }) {
    const iconMap: Record<string, React.ReactNode> = {
        IssueComment: <MessageSquare size={ICON_SIZE} />,
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
        MergedEvent: <GitMerge className="text-purple-500" size={ICON_SIZE} />,
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
    };

    const typename = event.__typename;
    const isApproved =
        typename === "PullRequestReview" && event.state === "approved";
    const isChangesRequested =
        typename === "PullRequestReview" && event.state === "changes_requested";

    const circleClass = isApproved
        ? "absolute -left-12 flex h-7 w-7 items-center justify-center rounded-full bg-green-500"
        : isChangesRequested
          ? "absolute -left-12 flex h-7 w-7 items-center justify-center rounded-full bg-red-500"
          : "absolute -left-12 flex h-7 w-7 items-center justify-center rounded-full bg-white ring-1 ring-gray-200 dark:bg-zinc-950 dark:ring-zinc-700";

    let icon = iconMap[typename] ?? <Circle size={ICON_SIZE} />;

    if (typename === "PullRequestReview") {
        if (event.state === "approved")
            icon = <Check className="text-white" size={ICON_SIZE} />;
        if (event.state === "changes_requested")
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
                            pages: old.pages.map((page) => ({
                                ...page,
                                commentReactions: {
                                    ...page.commentReactions,
                                    [commentId]: toggleReactionInList(
                                        page.commentReactions[commentId] ?? [],
                                        currentUserLogin,
                                        content,
                                    ),
                                },
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

    const handleCommentReaction = (
        commentId: number,
        content: ReactionContent,
    ) => {
        commentReactionMutation.mutate({ owner, repo, commentId, content });
    };

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
                        const updatedReactions = toggleReactionInList(
                            commentReactions[databaseId] ?? [],
                            currentUserLogin,
                            content,
                        );
                        return {
                            ...old,
                            pages: old.pages.map((page) => ({
                                ...page,
                                commentReactions: {
                                    ...page.commentReactions,
                                    [databaseId]: updatedReactions,
                                },
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

    const minimizedExpanded = (id: number) => expandedMinimized[id] ?? false;

    switch (event.__typename) {
        case "IssueComment": {
            if (event.body) {
                const isEditing = editingCommentId === event.databaseId;
                const isAuthor = event.author?.login === currentUserLogin;
                const displayBody = savedBodies[event.databaseId] ?? event.body;
                const isMinimized =
                    event.isMinimized && !minimizedExpanded(event.databaseId);
                if (isMinimized) {
                    return (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
                            <div className="flex items-center justify-between">
                                <p className="text-gray-500 text-sm dark:text-zinc-400">
                                    A comment by{" "}
                                    <span className="font-medium text-gray-700 dark:text-zinc-300">
                                        {event.author?.login ?? "unknown"}
                                    </span>{" "}
                                    was minimized as{" "}
                                    <span className="font-medium text-gray-700 dark:text-zinc-300">
                                        {event.minimizedReason
                                            ? formatReason(
                                                  event.minimizedReason,
                                              )
                                            : "outdated"}
                                    </span>
                                </p>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setExpandedMinimized((prev) => ({
                                            ...prev,
                                            [event.databaseId]: true,
                                        }))
                                    }
                                    className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-gray-500 text-xs transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                                >
                                    <ChevronDown size={14} />
                                    Show comment
                                </button>
                            </div>
                        </div>
                    );
                }
                const commentReactionsArr =
                    commentReactions[event.databaseId] ?? [];

                return (
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
                        createdAt={event.createdAt}
                        authorAssociation={event.authorAssociation}
                        isEditing={isEditing}
                        editBody={editBody}
                        onEditBodyChange={setEditBody}
                        onCancelEdit={() => setEditingCommentId(null)}
                        onSaveEdit={() => {
                            updateCommentMutation.mutate({
                                owner,
                                repo,
                                commentId: event.databaseId,
                                body: editBody,
                            });
                        }}
                        owner={owner}
                        repo={repo}
                        headerActions={
                            <>
                                {!isEditing && currentUserLogin && (
                                    <ReactionPicker
                                        disabled={!canInteract}
                                        reactions={commentReactionsArr}
                                        currentUserLogin={currentUserLogin}
                                        onReact={(content) =>
                                            handleCommentReaction(
                                                event.databaseId,
                                                content,
                                            )
                                        }
                                    />
                                )}
                                {event.isMinimized && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setExpandedMinimized((prev) => ({
                                                ...prev,
                                                [event.databaseId]: false,
                                            }))
                                        }
                                        className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-gray-400 text-xs transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-gray-300"
                                    >
                                        Hide comment
                                    </button>
                                )}
                                {isAuthor && canInteract && (
                                    <button
                                        type="button"
                                        className="cursor-pointer rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-gray-300"
                                        onClick={() => {
                                            setEditBody(displayBody);
                                            setEditingCommentId(
                                                event.databaseId,
                                            );
                                        }}
                                    >
                                        <SquarePen size={14} />
                                    </button>
                                )}
                            </>
                        }
                        footer={
                            !isEditing &&
                            commentReactionsArr.length > 0 && (
                                <div className="mx-6 flex flex-wrap items-center gap-1.5 px-4 pb-3">
                                    <ReactionBar
                                        disabled={!canInteract}
                                        reactions={commentReactionsArr}
                                        currentUserLogin={currentUserLogin}
                                        onReact={(content) =>
                                            handleCommentReaction(
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
                );
            }
            return null;
        }

        case "PullRequestReview": {
            const isEditing = editingCommentId === event.databaseId;
            const isAuthor = event.author?.login === currentUserLogin;
            const displayBody = savedBodies[event.databaseId] ?? event.body;
            const reviewReactionsArr = commentReactions[event.databaseId] ?? [];

            const handleReviewReaction = (content: ReactionContent) => {
                reviewReactionMutation.mutate({
                    subjectId: event.id,
                    content,
                    databaseId: event.databaseId,
                });
            };

            const timestamp = formatRelativeTime(
                event.submittedAt ?? event.createdAt,
            );
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
                                              avatar_url:
                                                  event.author.avatarUrl,
                                          }
                                        : null
                                }
                                variant="standalone"
                                userHref={event.author?.url}
                                createdAt={event.submittedAt ?? event.createdAt}
                                authorAssociation={event.authorAssociation}
                                isEditing={isEditing}
                                editBody={editBody}
                                onEditBodyChange={setEditBody}
                                onCancelEdit={() => setEditingCommentId(null)}
                                onSaveEdit={() => {
                                    updateReviewMutation.mutate({
                                        owner,
                                        repo,
                                        number,
                                        reviewId: event.databaseId,
                                        body: editBody,
                                    });
                                }}
                                owner={owner}
                                repo={repo}
                                headerActions={
                                    <div className="flex items-center gap-1">
                                        {!isEditing && currentUserLogin && (
                                            <ReactionPicker
                                                disabled={!canInteract}
                                                reactions={reviewReactionsArr}
                                                currentUserLogin={
                                                    currentUserLogin
                                                }
                                                onReact={(content) =>
                                                    handleReviewReaction(
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
                                                    setEditBody(displayBody);
                                                    setEditingCommentId(
                                                        event.databaseId,
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
                                                currentUserLogin={
                                                    currentUserLogin
                                                }
                                                onReact={(content) =>
                                                    handleReviewReaction(
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

        case "PullRequestCommit": {
            const commit = event.commit;
            const author = commit?.author;
            const actor = author
                ? {
                      __typename: author.user?.__typename,
                      login: author.user?.login ?? author.name ?? "unknown",
                      avatarUrl: author.avatarUrl,
                      url: author.user?.url,
                  }
                : null;
            return (
                <div className="item-center flex justify-between text-gray-600 text-sm dark:text-zinc-400">
                    <div className="item-center flex min-w-0 gap-2">
                        {actor && (
                            <UserLink actor={actor} showUsername={false} />
                        )}
                        <NextLink
                            href={`/${owner}/${repo}/pull/${number}/files/${commit?.oid}`}
                            className="truncate hover:text-blue-600 hover:underline dark:hover:text-blue-400"
                        >
                            {commit?.message.split("\n")[0]}
                        </NextLink>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {commit?.signature?.isValid && (
                            <VerifiedBadge signature={commit.signature} />
                        )}
                        <NextLink
                            href={`/${owner}/${repo}/pull/${number}/files/${commit?.oid}`}
                            className="font-mono text-gray-600 text-xs hover:text-blue-600 hover:underline dark:text-zinc-400 dark:hover:text-blue-400"
                        >
                            {commit?.oid.slice(0, 7)}
                        </NextLink>
                    </div>
                </div>
            );
        }

        case "ReviewDismissedEvent": {
            if (event.dismissalMessage) {
                return (
                    <p className="text-gray-600 text-sm dark:text-zinc-400">
                        {event.dismissalMessage}
                    </p>
                );
            }
            return null;
        }

        case "HeadRefForcePushedEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            const beforeShort =
                event.beforeCommit?.oid.slice(0, 7) ?? "unknown";
            const afterShort = event.afterCommit?.oid.slice(0, 7) ?? "unknown";
            const beforeHref = event.beforeCommit?.oid
                ? `/${owner}/${repo}/pull/${number}/files/${event.beforeCommit.oid}`
                : null;
            const afterHref = event.afterCommit?.oid
                ? `/${owner}/${repo}/pull/${number}/files/${event.afterCommit.oid}`
                : null;
            return (
                <EventRow>
                    <UserLink actor={event.actor} />
                    <p>
                        {"force pushed from "}
                        {beforeHref ? (
                            <NextLink
                                href={beforeHref}
                                className="rounded bg-gray-100 px-1 text-xs hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                            >
                                {beforeShort}
                            </NextLink>
                        ) : (
                            <code className="rounded bg-gray-100 px-1 text-xs dark:bg-zinc-800">
                                {beforeShort}
                            </code>
                        )}
                        {" to "}
                        {afterHref ? (
                            <NextLink
                                href={afterHref}
                                className="rounded bg-gray-100 px-1 text-xs hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                            >
                                {afterShort}
                            </NextLink>
                        ) : (
                            <code className="rounded bg-gray-100 px-1 text-xs dark:bg-zinc-800">
                                {afterShort}
                            </code>
                        )}
                    </p>
                    {timestamp}
                </EventRow>
            );
        }

        case "ReferencedEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            const sha = event.commit?.oid?.slice(0, 7);
            return (
                <EventRow>
                    <UserLink actor={event.actor} />
                    <p>
                        {" referenced this "}
                        {timestamp}
                    </p>
                    {sha && (
                        <a
                            href={event.commit?.commitUrl ?? undefined}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-xs hover:underline"
                        >
                            {sha}
                        </a>
                    )}
                </EventRow>
            );
        }

        case "HeadRefDeletedEvent":
        case "HeadRefRestoredEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            const verb =
                event.__typename === "HeadRefDeletedEvent"
                    ? "deleted"
                    : "restored";
            return (
                <EventRow>
                    <UserLink actor={event.actor} />
                    <p>
                        {` ${verb} the `}
                        <span className="font-medium text-gray-800 dark:text-zinc-200">
                            branch
                        </span>
                        {` ${timestamp}`}
                    </p>
                </EventRow>
            );
        }

        case "CrossReferencedEvent": {
            const actor = event.actor;
            const timestamp = formatRelativeTime(event.createdAt);
            const source = event.source;
            const repoName = source?.repository.name;
            const repoOwner = source?.repository.owner.login;
            const repoFullName =
                repoOwner && repoName ? `${repoOwner}/${repoName}` : null;
            const sourceNumber = source?.number;
            const sourceTitle = source?.title;
            const sourceUrl = source?.url;
            const isPR = source?.__typename === "PullRequest";

            return (
                <div className="text-gray-600 text-sm dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                        <UserLink actor={actor} />
                        <span>
                            {` mentioned this ${isPR ? "pull request" : "issue"} `}
                            {timestamp}
                        </span>
                    </div>
                    {source && (
                        <a
                            href={sourceUrl ?? undefined}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 ml-7 flex w-fit items-center gap-1.5 hover:underline"
                        >
                            <span className="font-medium text-gray-800 dark:text-zinc-200">
                                {sourceTitle}
                            </span>
                            {repoFullName && sourceNumber && (
                                <span className="text-gray-400 text-xs dark:text-zinc-500">
                                    {repoFullName}#{sourceNumber}
                                </span>
                            )}
                        </a>
                    )}
                </div>
            );
        }

        case "AssignedEvent":
        case "UnassignedEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            const isSelfAssigned = event.actor?.login === event.assignee?.login;
            const isAssigned = event.__typename === "AssignedEvent";

            if (isSelfAssigned && event.assignee) {
                return (
                    <EventRow>
                        <UserLink actor={event.assignee} />
                        <span>
                            {isAssigned
                                ? " self-assigned this "
                                : " removed their assignment "}
                            {timestamp}
                        </span>
                    </EventRow>
                );
            }
            return (
                <EventRow>
                    <UserLink actor={event.actor} />
                    <div className="flex gap-1">
                        {isAssigned ? " assigned " : " unassigned "}
                        <UserLink actor={event.assignee} /> {timestamp}
                    </div>
                </EventRow>
            );
        }

        case "BaseRefChangedEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            return (
                <EventRow>
                    <UserLink actor={event.actor} />
                    <p>
                        {" changed the base branch from "}
                        <span className="font-medium text-gray-800 line-through dark:text-zinc-200">
                            {event.previousRefName}
                        </span>
                        {" → "}
                        <span className="font-medium text-gray-800 dark:text-zinc-200">
                            {event.currentRefName}
                        </span>{" "}
                        {timestamp}
                    </p>
                </EventRow>
            );
        }

        case "MergedEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            const sha = event.commit?.abbreviatedOid;
            const commitUrl = event.commit?.commitUrl;
            return (
                <EventRow>
                    <UserLink actor={event.actor} />
                    <p>
                        {" merged commit "}
                        {sha && commitUrl ? (
                            <a
                                href={commitUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-xs hover:text-blue-600 hover:underline dark:hover:text-blue-400"
                            >
                                {sha}
                            </a>
                        ) : (
                            <span className="font-mono text-xs">{sha}</span>
                        )}
                        {" into "}
                        <a
                            href={`https://github.com/${owner}/${repo}/tree/${event.mergeRefName}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium hover:text-blue-600 hover:underline dark:hover:text-blue-400"
                        >
                            {event.mergeRefName}
                        </a>
                        {" this "}
                        {timestamp}
                    </p>
                </EventRow>
            );
        }
        case "ClosedEvent":
        case "ReopenedEvent":
        case "ConvertToDraftEvent":
        case "ReadyForReviewEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            const verb =
                event.__typename === "ClosedEvent"
                    ? "closed"
                    : event.__typename === "ReopenedEvent"
                      ? "reopened"
                      : event.__typename === "ConvertToDraftEvent"
                        ? "converted to draft"
                        : "marked ready for review";
            return (
                <EventRow>
                    <UserLink actor={event.actor} />
                    <p>
                        {verb}
                        {" this "}
                        {timestamp}
                    </p>
                </EventRow>
            );
        }

        case "RenamedTitleEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            return (
                <EventRow>
                    <UserLink actor={event.actor} />
                    <p>
                        {" renamed this "}
                        <span className="font-medium text-gray-800 line-through dark:text-zinc-200">
                            {event.previousTitle}
                        </span>
                        {" → "}
                        <span className="font-medium text-gray-800 dark:text-zinc-200">
                            {event.currentTitle}
                        </span>{" "}
                        {timestamp}
                    </p>
                </EventRow>
            );
        }

        case "MilestonedEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            return (
                <EventRow>
                    <UserLink actor={event.actor} />
                    <p>
                        {" added the milestone "}
                        <span className="font-medium text-gray-800 dark:text-zinc-200">
                            {event.milestoneTitle ?? ""}
                        </span>
                        {` ${timestamp}`}
                    </p>
                </EventRow>
            );
        }

        case "DemilestonedEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            return (
                <EventRow>
                    <UserLink actor={event.actor} />
                    <p>
                        {" removed the milestone "}
                        <span className="font-medium text-gray-800 dark:text-zinc-200">
                            {event.milestoneTitle ?? ""}
                        </span>
                        {` ${timestamp}`}
                    </p>
                </EventRow>
            );
        }

        case "LockedEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            return (
                <EventRow>
                    <UserLink actor={event.actor} />
                    <p>
                        {" locked this"}
                        {event.lockReason && (
                            <>
                                {" (reason: "}
                                <span className="font-medium text-gray-800 dark:text-zinc-200">
                                    {formatReason(event.lockReason)}
                                </span>
                                {")"}
                            </>
                        )}
                        {` ${timestamp}`}
                    </p>
                </EventRow>
            );
        }

        case "UnlockedEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            return (
                <EventRow>
                    <UserLink actor={event.actor} />
                    <p>
                        {" unlocked this "}
                        {timestamp}
                    </p>
                </EventRow>
            );
        }

        case "ReviewRequestedEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            const reviewer = event.requestedReviewer;
            const isUser = reviewer?.__typename === "User";
            const isTeam = reviewer?.__typename === "Team";
            return (
                <EventRow>
                    <UserLink actor={event.actor} />
                    <p>
                        {" requested a review from "}
                        {isUser && reviewer && (
                            <UserHoverCard login={reviewer.login}>
                                <a
                                    className="inline-flex items-center gap-1 font-medium text-gray-800 dark:text-zinc-200"
                                    href={reviewer.url}
                                >
                                    <img
                                        src={reviewer.avatarUrl}
                                        alt={reviewer.login}
                                        className="h-4 w-4 rounded-full"
                                    />
                                    {reviewer.login}
                                </a>
                            </UserHoverCard>
                        )}
                        {isTeam && reviewer && (
                            <span className="font-medium text-gray-800 dark:text-zinc-200">
                                {reviewer.name ?? reviewer.slug}
                            </span>
                        )}
                        {` ${timestamp}`}
                    </p>
                </EventRow>
            );
        }

        case "ReviewRequestRemovedEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            const reviewer = event.requestedReviewer;
            const isUser = reviewer?.__typename === "User";
            const isTeam = reviewer?.__typename === "Team";
            return (
                <EventRow>
                    <UserLink actor={event.actor} />
                    <p>
                        {" removed the review request for "}
                        {isUser && reviewer && (
                            <UserHoverCard login={reviewer.login}>
                                <a
                                    className="inline-flex items-center gap-1 font-medium text-gray-800 dark:text-zinc-200"
                                    href={reviewer.url}
                                >
                                    <img
                                        src={reviewer.avatarUrl}
                                        alt={reviewer.login}
                                        className="h-4 w-4 rounded-full"
                                    />
                                    {reviewer.login}
                                </a>
                            </UserHoverCard>
                        )}
                        {isTeam && reviewer && (
                            <span className="font-medium text-gray-800 dark:text-zinc-200">
                                {reviewer.name ?? reviewer.slug}
                            </span>
                        )}
                        {` ${timestamp}`}
                    </p>
                </EventRow>
            );
        }

        case "AddedToProjectV2Event": {
            const timestamp = formatRelativeTime(event.createdAt);
            return (
                <EventRow>
                    <UserLink actor={event.actor} />
                    <p>Added this issue to a project {timestamp}</p>
                </EventRow>
            );
        }

        case "ProjectV2ItemStatusChangedEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            return (
                <EventRow>
                    <UserLink actor={event.actor} />
                    <p>changed the project status {timestamp}</p>
                </EventRow>
            );
        }

        case "DeployedEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            const environment = event.deployment?.environment ?? "a deployment";
            const refName = event.ref?.name ?? null;
            return (
                <EventRow>
                    <UserLink actor={event.actor} />
                    <p>
                        {" deployed to "}
                        <span className="font-medium text-gray-800 dark:text-zinc-200">
                            {environment}
                        </span>
                        {refName ? (
                            <>
                                {" ("}
                                <span className="font-medium text-gray-800 dark:text-zinc-200">
                                    {refName}
                                </span>
                                {")"}
                            </>
                        ) : null}
                        {` ${timestamp}`}
                    </p>
                </EventRow>
            );
        }

        default:
            console.warn(`unknown event type: ${event.__typename}`, event);
            return null;
    }
}
