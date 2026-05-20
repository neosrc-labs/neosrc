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
    GitCommitHorizontal,
    GitMerge,
    Link,
    Lock,
    LockOpen,
    MessageSquare,
    Pencil,
    RefreshCw,
    SquarePen,
    Tag,
    Target,
    Trash2,
    User,
} from "lucide-react";
import { useState } from "react";
import { CommentCard } from "~/components/CommentCard";
import { MarkdownRenderer } from "~/components/markdown/MarkdownRenderer";
import { type Reaction, ReactionRollup } from "~/components/ReactionRollup";
import { Label } from "~/components/ui/label";
import { UserHoverCard } from "~/components/user-hover-card";
import type { ReviewComment } from "~/server/github";
import type {
    GQLActor,
    GQLReactionNode,
    GQLTimelineEvent,
} from "~/server/github-graphql";
import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/utils";
import { ReviewComments } from "./review-comments";
import type { TimelineWrapper } from "./timeline-types";

interface TimelineEventProps {
    wrapper: TimelineWrapper;
    owner: string;
    repo: string;
    number: number;
    commentReactions: Record<number, GQLReactionNode[]>;
    currentUserLogin: string;
    allComments: ReviewComment[];
}

export function TimelineEvent({
    wrapper,
    owner,
    repo,
    number,
    commentReactions,
    currentUserLogin,
    allComments,
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
                <UserHoverCard login={actor.login}>
                    <a className="flex items-center gap-1.5" href={actor.url}>
                        <img
                            src={actor.avatarUrl}
                            alt={actor.login}
                            className="h-5 w-5 rounded-full"
                        />
                        <span className="font-medium text-gray-800 dark:text-zinc-200">
                            {actor.login}
                        </span>
                    </a>
                </UserHoverCard>
                {added.length > 0 && (
                    <>
                        {" added "}
                        {added.map((c, i) => (
                            <span key={c.label.name}>
                                {i > 0 && i === added.length - 1
                                    ? " and "
                                    : i > 0
                                      ? ", "
                                      : ""}
                                <Label color={c.label.color}>
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
                                    : i > 0
                                      ? ", "
                                      : ""}
                                <Label color={c.label.color}>
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
}: {
    event: GQLTimelineEvent;
    owner: string;
    repo: string;
    number: number;
    commentReactions: Record<number, GQLReactionNode[]>;
    currentUserLogin: string;
    allComments: ReviewComment[];
}) {
    const [editingCommentId, setEditingCommentId] = useState<number | null>(
        null,
    );
    const [editBody, setEditBody] = useState("");
    const [savedBodies, setSavedBodies] = useState<Record<number, string>>({});
    const [expandedMinimized, setExpandedMinimized] = useState<Record<number, boolean>>({});

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

    const minimizedExpanded = (id: number) => expandedMinimized[id] ?? false;

    switch (event.__typename) {
        case "IssueComment": {
            if (event.body) {
                const isEditing = editingCommentId === event.databaseId;
                const isAuthor = event.author?.login === currentUserLogin;
                const displayBody = savedBodies[event.databaseId] ?? event.body;
                const isMinimized = event.isMinimized && !minimizedExpanded(event.databaseId);
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
                                        {event.minimizedReason ?? "outdated"}
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
                                {isAuthor && (
                                    <button
                                        type="button"
                                        className="cursor-pointer rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-gray-300"
                                        onClick={() => {
                                            setEditBody(displayBody);
                                            setEditingCommentId(event.databaseId);
                                        }}
                                    >
                                        <SquarePen size={14} />
                                    </button>
                                )}
                            </>
                        }
                        footer={
                            !isEditing && (
                                <div className="px-3 pb-3">
                                    <ReactionRollup
                                        reactions={
                                            commentReactions[
                                                event.databaseId
                                            ] ?? []
                                        }
                                        currentUserLogin={currentUserLogin}
                                        commentId={event.databaseId}
                                        owner={owner}
                                        repo={repo}
                                        number={number}
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
                <div className="text-gray-600 text-sm dark:text-zinc-400">
                    <p className="flex items-center gap-1.5">
                        {event.author && (
                            <UserHoverCard login={event.author.login}>
                                <a
                                    className="flex items-center gap-1.5"
                                    href={event.author.url}
                                >
                                    <img
                                        src={event.author.avatarUrl}
                                        alt={event.author.login}
                                        className="h-5 w-5 rounded-full"
                                    />
                                    <span className="font-medium text-gray-800 dark:text-zinc-200">
                                        {event.author.login}
                                    </span>
                                </a>
                            </UserHoverCard>
                        )}
                        {` ${stateLabel} ${timestamp}`}
                    </p>
                    {event.body && (
                        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
                            <div className="prose prose-sm max-w-none">
                                <MarkdownRenderer
                                    content={event.body}
                                    owner={owner}
                                    repo={repo}
                                />
                            </div>
                        </div>
                    )}
                    <ReviewComments
                        owner={owner}
                        repo={repo}
                        number={number}
                        reviewId={event.databaseId}
                        state={state}
                        allComments={allComments}
                    />
                </div>
            );
        }

        case "PullRequestCommit": {
            const commit = event.commit;
            return (
                <div className="item-center flex justify-between text-gray-600 text-sm dark:text-zinc-400">
                    <div>
                        <p>{commit?.message.split("\n")[0]}</p>
                    </div>
                    <code className="text-xs">{commit?.oid.slice(0, 7)}</code>
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
            const before = event.beforeCommit?.oid.slice(0, 7) ?? "unknown";
            const after = event.afterCommit?.oid.slice(0, 7) ?? "unknown";
            return (
                <div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
                    <UserHoverCard login={event.actor?.login ?? ""}>
                        <a
                            className="flex items-center gap-2"
                            href={event.actor?.url ?? ""}
                        >
                            <img
                                src={event.actor?.avatarUrl ?? ""}
                                alt={event.actor?.login ?? ""}
                                className="h-5 w-5 rounded-full"
                            />
                            {event.actor?.login}
                        </a>
                    </UserHoverCard>
                    <p>
                        {"force pushed from "}
                        <code className="rounded bg-gray-100 px-1 text-xs dark:bg-zinc-800">
                            {before}
                        </code>
                        {" to "}
                        <code className="rounded bg-gray-100 px-1 text-xs dark:bg-zinc-800">
                            {after}
                        </code>
                    </p>
                    {timestamp}
                </div>
            );
        }

        case "ReferencedEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            const sha = event.commit?.oid?.slice(0, 7);
            return (
                <div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
                    <UserHoverCard login={event.actor?.login ?? ""}>
                        <a
                            className="flex items-center gap-2"
                            href={event.actor?.url ?? ""}
                        >
                            <img
                                src={event.actor?.avatarUrl ?? ""}
                                alt={event.actor?.login ?? ""}
                                className="h-5 w-5 rounded-full"
                            />
                            <span className="font-medium text-gray-800 dark:text-zinc-200">
                                {event.actor?.login}
                            </span>
                        </a>
                    </UserHoverCard>
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
                </div>
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
                <div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
                    <img
                        src={event.actor?.avatarUrl ?? ""}
                        alt={event.actor?.login ?? ""}
                        className="h-5 w-5 rounded-full"
                    />
                    <p>
                        <span className="font-medium text-gray-800 dark:text-zinc-200">
                            {event.actor?.login}
                        </span>
                        {` ${verb} the `}
                        <span className="font-medium text-gray-800 dark:text-zinc-200">
                            branch
                        </span>
                        {` ${timestamp}`}
                    </p>
                </div>
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
                        {actor && (
                            <UserHoverCard login={actor.login}>
                                <a
                                    className="flex items-center gap-2"
                                    href={actor.url}
                                >
                                    <img
                                        src={actor.avatarUrl}
                                        alt={actor.login}
                                        className="h-5 w-5 rounded-full"
                                    />
                                    <span className="font-medium text-gray-800 dark:text-zinc-200">
                                        {actor.login}
                                    </span>
                                </a>
                            </UserHoverCard>
                        )}
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
                    <div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
                        <UserHoverCard login={event.assignee.login}>
                            <a
                                className="flex items-center gap-2"
                                href={event.assignee.url}
                            >
                                <img
                                    src={event.assignee.avatarUrl}
                                    alt={event.assignee.login}
                                    className="h-5 w-5 rounded-full"
                                />
                                <span className="font-medium text-gray-800 dark:text-zinc-200">
                                    {event.assignee.login}
                                </span>
                            </a>
                        </UserHoverCard>
                        <span>
                            {isAssigned
                                ? " self-assigned this "
                                : " removed their assignment "}
                            {timestamp}
                        </span>
                    </div>
                );
            }
            return (
                <div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
                    <UserHoverCard login={event.actor?.login ?? ""}>
                        <a
                            className="flex items-center gap-2"
                            href={event.actor?.url ?? ""}
                        >
                            <img
                                src={event.actor?.avatarUrl ?? ""}
                                alt={event.actor?.login ?? ""}
                                className="h-5 w-5 rounded-full"
                            />
                            <span className="font-medium text-gray-800 dark:text-zinc-200">
                                {event.actor?.login}
                            </span>
                        </a>
                    </UserHoverCard>
                    <div className="flex gap-1">
                        {isAssigned ? " assigned " : " unassigned "}
                        <UserHoverCard login={event.assignee?.login ?? ""}>
                            <a
                                className="flex items-center gap-2"
                                href={event.assignee?.url ?? ""}
                            >
                                <img
                                    src={event.assignee?.avatarUrl ?? ""}
                                    alt={event.assignee?.login ?? ""}
                                    className="h-5 w-5 rounded-full"
                                />
                                <span className="font-medium text-gray-800 dark:text-zinc-200">
                                    {event.assignee?.login}
                                </span>
                            </a>
                        </UserHoverCard>{" "}
                        {timestamp}
                    </div>
                </div>
            );
        }

        case "ClosedEvent":
        case "MergedEvent":
        case "ReopenedEvent":
        case "ConvertToDraftEvent":
        case "ReadyForReviewEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            const verb =
                event.__typename === "ClosedEvent"
                    ? "closed"
                    : event.__typename === "MergedEvent"
                      ? "merged"
                      : event.__typename === "ReopenedEvent"
                        ? "reopened"
                        : event.__typename === "ConvertToDraftEvent"
                          ? "converted to draft"
                          : "marked ready for review";
            return (
                <div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
                    <UserHoverCard login={event.actor?.login ?? ""}>
                        <a
                            className="flex items-center gap-2"
                            href={event.actor?.url ?? ""}
                        >
                            <img
                                src={event.actor?.avatarUrl ?? ""}
                                alt={event.actor?.login ?? ""}
                                className="h-5 w-5 rounded-full"
                            />
                            <span className="font-medium text-gray-800 dark:text-zinc-200">
                                {event.actor?.login}
                            </span>{" "}
                        </a>
                    </UserHoverCard>
                    <p>
                        {verb}
                        {" this "}
                        {timestamp}
                    </p>
                </div>
            );
        }

        case "RenamedTitleEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            return (
                <div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
                    <img
                        src={event.actor?.avatarUrl ?? ""}
                        alt={event.actor?.login ?? ""}
                        className="h-5 w-5 rounded-full"
                    />
                    <p>
                        <span className="font-medium text-gray-800 dark:text-zinc-200">
                            {event.actor?.login}
                        </span>
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
                </div>
            );
        }

        case "MilestonedEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            return (
                <div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
                    <UserHoverCard login={event.actor?.login ?? ""}>
                        <a
                            className="flex items-center gap-2"
                            href={event.actor?.url ?? ""}
                        >
                            <img
                                src={event.actor?.avatarUrl ?? ""}
                                alt={event.actor?.login ?? ""}
                                className="h-5 w-5 rounded-full"
                            />
                            <span className="font-medium text-gray-800 dark:text-zinc-200">
                                {event.actor?.login}
                            </span>
                        </a>
                    </UserHoverCard>
                    <p>
                        {" added the milestone "}
                        <span className="font-medium text-gray-800 dark:text-zinc-200">
                            {event.milestoneTitle ?? ""}
                        </span>
                        {` ${timestamp}`}
                    </p>
                </div>
            );
        }

        case "DemilestonedEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            return (
                <div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
                    <UserHoverCard login={event.actor?.login ?? ""}>
                        <a
                            className="flex items-center gap-2"
                            href={event.actor?.url ?? ""}
                        >
                            <img
                                src={event.actor?.avatarUrl ?? ""}
                                alt={event.actor?.login ?? ""}
                                className="h-5 w-5 rounded-full"
                            />
                            <span className="font-medium text-gray-800 dark:text-zinc-200">
                                {event.actor?.login}
                            </span>
                        </a>
                    </UserHoverCard>
                    <p>
                        {" removed the milestone "}
                        <span className="font-medium text-gray-800 dark:text-zinc-200">
                            {event.milestoneTitle ?? ""}
                        </span>
                        {` ${timestamp}`}
                    </p>
                </div>
            );
        }

        case "LockedEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            return (
                <div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
                    <UserHoverCard login={event.actor?.login ?? ""}>
                        <a
                            className="flex items-center gap-2"
                            href={event.actor?.url ?? ""}
                        >
                            <img
                                src={event.actor?.avatarUrl ?? ""}
                                alt={event.actor?.login ?? ""}
                                className="h-5 w-5 rounded-full"
                            />
                            <span className="font-medium text-gray-800 dark:text-zinc-200">
                                {event.actor?.login}
                            </span>
                        </a>
                    </UserHoverCard>
                    <p>
                        {" locked this"}
                        {event.lockReason && (
                            <>
                                {" (reason: "}
                                <span className="font-medium text-gray-800 dark:text-zinc-200">
                                    {event.lockReason}
                                </span>
                                {")"}
                            </>
                        )}
                        {` ${timestamp}`}
                    </p>
                </div>
            );
        }

        case "UnlockedEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            return (
                <div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
                    <UserHoverCard login={event.actor?.login ?? ""}>
                        <a
                            className="flex items-center gap-2"
                            href={event.actor?.url ?? ""}
                        >
                            <img
                                src={event.actor?.avatarUrl ?? ""}
                                alt={event.actor?.login ?? ""}
                                className="h-5 w-5 rounded-full"
                            />
                            <span className="font-medium text-gray-800 dark:text-zinc-200">
                                {event.actor?.login}
                            </span>
                        </a>
                    </UserHoverCard>
                    <p>
                        {" unlocked this "}
                        {timestamp}
                    </p>
                </div>
            );
        }

        case "ReviewRequestedEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            const reviewer = event.requestedReviewer;
            const isUser = reviewer?.__typename === "User";
            const isTeam = reviewer?.__typename === "Team";
            return (
                <div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
                    <UserHoverCard login={event.actor?.login ?? ""}>
                        <a
                            className="flex items-center gap-2"
                            href={event.actor?.url ?? ""}
                        >
                            <img
                                src={event.actor?.avatarUrl ?? ""}
                                alt={event.actor?.login ?? ""}
                                className="h-5 w-5 rounded-full"
                            />
                            <span className="font-medium text-gray-800 dark:text-zinc-200">
                                {event.actor?.login}
                            </span>
                        </a>
                    </UserHoverCard>
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
                </div>
            );
        }

        case "ReviewRequestRemovedEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            const reviewer = event.requestedReviewer;
            const isUser = reviewer?.__typename === "User";
            const isTeam = reviewer?.__typename === "Team";
            return (
                <div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
                    <UserHoverCard login={event.actor?.login ?? ""}>
                        <a
                            className="flex items-center gap-2"
                            href={event.actor?.url ?? ""}
                        >
                            <img
                                src={event.actor?.avatarUrl ?? ""}
                                alt={event.actor?.login ?? ""}
                                className="h-5 w-5 rounded-full"
                            />
                            <span className="font-medium text-gray-800 dark:text-zinc-200">
                                {event.actor?.login}
                            </span>
                        </a>
                    </UserHoverCard>
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
                </div>
            );
        }

        case "AddedToProjectV2Event": {
            const timestamp = formatRelativeTime(event.createdAt);
            return (
                <div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
                    <UserHoverCard login={event.actor?.login ?? ""}>
                        <a
                            className="flex items-center gap-2"
                            href={event.actor?.url ?? ""}
                        >
                            <img
                                src={event.actor?.avatarUrl ?? ""}
                                alt={event.actor?.login ?? ""}
                                className="h-5 w-5 rounded-full"
                            />
                            <span className="font-medium text-gray-800 dark:text-zinc-200">
                                {event.actor?.login}
                            </span>
                        </a>
                    </UserHoverCard>
                    <p>Added this issue to a project {timestamp}</p>
                </div>
            );
        }

        case "ProjectV2ItemStatusChangedEvent": {
            const timestamp = formatRelativeTime(event.createdAt);
            return (
                <div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
                    <UserHoverCard login={event.actor?.login ?? ""}>
                        <a
                            className="flex items-center gap-2"
                            href={event.actor?.url ?? ""}
                        >
                            <img
                                src={event.actor?.avatarUrl ?? ""}
                                alt={event.actor?.login ?? ""}
                                className="h-5 w-5 rounded-full"
                            />
                            <span className="font-medium text-gray-800 dark:text-zinc-200">
                                {event.actor?.login}
                            </span>
                        </a>
                    </UserHoverCard>
                    <p>changed the project status {timestamp}</p>
                </div>
            );
        }

        default:
            console.warn(`unknown event type: ${event.__typename}`, event);
            return null;
    }
}
