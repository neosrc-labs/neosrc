"use client";

import {
    Check,
    ChevronDown,
    Link,
    MoreVertical,
    SquarePen,
    Trash2,
} from "lucide-react";
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
import type { ReactionContent } from "~/lib/reactions";
import type { GQLIssueComment, GQLReactionNode } from "~/server/github-graphql";
import { formatReason } from "../event";

interface IssueCommentContentProps {
    event: GQLIssueComment;
    owner: string;
    repo: string;
    currentUserLogin: string;
    canInteract: boolean;
    commentReactions: Record<number, GQLReactionNode[]>;
    editingCommentId: number | null;
    editBody: string;
    savedBodies: Record<number, string>;
    expandedMinimized: Record<number, boolean>;
    onEditBodyChange: (body: string) => void;
    onStartEdit: (commentId: number, body: string) => void;
    onCancelEdit: () => void;
    onSaveEdit: (commentId: number, body: string) => void;
    onDelete: (commentId: number) => void;
    onReactToComment: (commentId: number, content: ReactionContent) => void;
    onToggleMinimized: (commentId: number, expanded: boolean) => void;
}

export function IssueCommentContent({
    event,
    owner,
    repo,
    currentUserLogin,
    canInteract,
    commentReactions,
    editingCommentId,
    editBody,
    savedBodies,
    expandedMinimized,
    onEditBodyChange,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onDelete,
    onReactToComment,
    onToggleMinimized,
}: IssueCommentContentProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopyLink = useCallback(async () => {
        const url = `${window.location.origin}${window.location.pathname}#issuecomment-${event.databaseId}`;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [event.databaseId]);

    if (!event.body) return null;

    const isEditing = editingCommentId === event.databaseId;
    const isAuthor = event.author?.login === currentUserLogin;
    const isPending = event.databaseId < 0;
    const displayBody = savedBodies[event.databaseId] ?? event.body;
    const isMinimized =
        event.isMinimized && !expandedMinimized[event.databaseId];

    if (isMinimized) {
        return (
            <div className="/50 rounded-lg border border-border bg-surface-secondary p-3">
                <div className="flex items-center justify-between">
                    <p className="text-sm text-text-tertiary">
                        A comment by{" "}
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
                        Show comment
                    </button>
                </div>
            </div>
        );
    }

    const commentReactionsArr = commentReactions[event.databaseId] ?? [];

    return (
        <CommentCard
            id={`issuecomment-${event.databaseId}`}
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
            tailDirection="left"
            userHref={event.author?.url}
            createdAt={event.createdAt}
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
                <>
                    {event.isMinimized && (
                        <button
                            type="button"
                            onClick={() =>
                                onToggleMinimized(event.databaseId, false)
                            }
                            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-text-muted text-xs transition-colors hover:bg-surface-tertiary hover:text-text-secondary dark:hover:text-zinc-300"
                        >
                            Hide comment
                        </button>
                    )}
                    {!isEditing && !isPending && (
                        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
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
                                    {copied ? "Copied" : "Copy link"}
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
                                        className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-text-label transition-colors hover:bg-surface-tertiary"
                                    >
                                        <SquarePen size={14} />
                                        Edit
                                    </button>
                                )}
                                {canInteract && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onDelete(event.databaseId);
                                            setMenuOpen(false);
                                        }}
                                        className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-text-label transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                                    >
                                        <Trash2 size={14} />
                                        Delete comment
                                    </button>
                                )}
                            </PopoverContent>
                        </Popover>
                    )}
                    {isPending && (
                        <span className="inline-flex animate-pulse items-center rounded p-1 font-medium text-text-muted text-xs">
                            Saving...
                        </span>
                    )}
                </>
            }
            footer={
                !isEditing && (
                    <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
                        <ReactionPicker
                            disabled={!canInteract || isPending}
                            reactions={commentReactionsArr}
                            currentUserLogin={currentUserLogin}
                            onReact={(content) =>
                                onReactToComment(event.databaseId, content)
                            }
                        />
                        <ReactionBar
                            disabled={!canInteract || isPending}
                            reactions={commentReactionsArr}
                            currentUserLogin={currentUserLogin}
                            onReact={(content) =>
                                onReactToComment(event.databaseId, content)
                            }
                        />
                    </div>
                )
            }
        >
            <MarkdownRenderer content={displayBody} owner={owner} repo={repo} />
        </CommentCard>
    );
}
