"use client";

import { ChevronDown, SquarePen } from "lucide-react";
import { CommentCard } from "~/components/CommentCard";
import { MarkdownRenderer } from "~/components/markdown/MarkdownRenderer";
import { ReactionBar } from "~/components/ReactionBar";
import { ReactionPicker } from "~/components/ReactionPicker";
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
    onReactToComment,
    onToggleMinimized,
}: IssueCommentContentProps) {
    if (!event.body) return null;

    const isEditing = editingCommentId === event.databaseId;
    const isAuthor = event.author?.login === currentUserLogin;
    const displayBody = savedBodies[event.databaseId] ?? event.body;
    const isMinimized =
        event.isMinimized && !expandedMinimized[event.databaseId];

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
                                ? formatReason(event.minimizedReason)
                                : "outdated"}
                        </span>
                    </p>
                    <button
                        type="button"
                        onClick={() =>
                            onToggleMinimized(event.databaseId, true)
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

    const commentReactionsArr = commentReactions[event.databaseId] ?? [];

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
            onEditBodyChange={onEditBodyChange}
            onCancelEdit={onCancelEdit}
            onSaveEdit={() => {
                onSaveEdit(event.databaseId, editBody);
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
                                onReactToComment(event.databaseId, content)
                            }
                        />
                    )}
                    {event.isMinimized && (
                        <button
                            type="button"
                            onClick={() =>
                                onToggleMinimized(event.databaseId, false)
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
                                onStartEdit(event.databaseId, displayBody);
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
