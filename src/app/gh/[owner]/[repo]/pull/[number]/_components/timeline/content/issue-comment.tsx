"use client";

import { useState } from "react";
import { CommentDeleteDialog } from "~/components/comment-delete-dialog";
import {
    CommentMenu,
    CopyLinkMenuItem,
    DeleteMenuItem,
    EditMenuItem,
} from "~/components/comment-menu";
import { CommentReactionFooter } from "~/components/comment-reaction-footer";
import { MarkdownRenderer } from "~/components/markdown/markdown-renderer";
import { MinimizedCommentBanner } from "~/components/minimized-comment-banner";
import { TimelineCommentCard } from "~/components/timeline-comment-card";
import { type TaskToggleApi, useTaskToggle } from "~/hooks/use-task-toggle";
import type { ReactionContent } from "~/lib/reactions";
import type { GQLIssueComment, GQLReactionNode } from "~/server/github-graphql";
import {
    canEdit,
    canInteract,
    type PullRequestPermissionContext,
} from "../../../permissions-utils";

interface IssueCommentContentProps {
    event: GQLIssueComment;
    owner: string;
    repo: string;
    permissionContext: PullRequestPermissionContext;
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
    commentToggleMutation: TaskToggleApi<{
        owner: string;
        repo: string;
        commentId: number;
        body: string;
    }>;
}

export function IssueCommentContent({
    event,
    owner,
    repo,
    permissionContext,
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
    commentToggleMutation,
}: IssueCommentContentProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const { onToggleTask } = useTaskToggle({
        mutation: commentToggleMutation,
        staticInput: { owner, repo, commentId: event.databaseId },
    });

    if (!event.body) return null;

    const isEditing = editingCommentId === event.databaseId;
    const isAuthor = event.author?.login === permissionContext.currentUser;
    const isPending = event.databaseId < 0;
    const displayBody = savedBodies[event.databaseId] ?? event.body;
    const isMinimized =
        event.isMinimized && !expandedMinimized[event.databaseId];
    const _canInteract = canInteract(permissionContext);
    const _canEdit = canEdit(permissionContext);

    if (isMinimized) {
        return (
            <MinimizedCommentBanner
                subject="comment"
                authorLogin={event.author?.login}
                minimizedReason={event.minimizedReason}
                onShow={() => onToggleMinimized(event.databaseId, true)}
            />
        );
    }

    const commentReactionsArr = commentReactions[event.databaseId] ?? [];

    return (
        <>
            <TimelineCommentCard
                id={`issuecomment-${event.databaseId}`}
                user={
                    event.author
                        ? {
                              login: event.author.login,
                              avatar_url: event.author.avatarUrl,
                          }
                        : null
                }
                tailDirection="left"
                userHref={event.author?.url}
                databaseId={event.databaseId}
                createdAt={event.createdAt}
                authorAssociation={event.authorAssociation}
                isEditing={isEditing}
                editBody={editBody}
                onEditBodyChange={onEditBodyChange}
                onCancelEdit={onCancelEdit}
                onSaveEdit={onSaveEdit}
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
                            <CommentMenu
                                open={menuOpen}
                                onOpenChange={setMenuOpen}
                            >
                                <CopyLinkMenuItem
                                    anchor={`issuecomment-${event.databaseId}`}
                                    onClose={() => setMenuOpen(false)}
                                />
                                {(isAuthor || _canEdit) && _canInteract && (
                                    <EditMenuItem
                                        onClick={() =>
                                            onStartEdit(
                                                event.databaseId,
                                                displayBody,
                                            )
                                        }
                                        onClose={() => setMenuOpen(false)}
                                    />
                                )}
                                {_canInteract && (
                                    <DeleteMenuItem
                                        onClick={() =>
                                            setDeleteConfirmOpen(true)
                                        }
                                        onClose={() => setMenuOpen(false)}
                                    />
                                )}
                            </CommentMenu>
                        )}
                        {isPending && (
                            <span className="inline-flex animate-pulse items-center rounded p-1 font-medium text-text-muted text-xs">
                                Saving...
                            </span>
                        )}
                    </>
                }
                footer={
                    !isEditing &&
                    _canInteract && (
                        <CommentReactionFooter
                            disabled={isPending}
                            reactions={commentReactionsArr}
                            currentUserLogin={permissionContext.currentUser}
                            onReact={(content) =>
                                onReactToComment(event.databaseId, content)
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
                        (isAuthor || _canEdit) && _canInteract && !isPending
                    }
                />
            </TimelineCommentCard>
            <CommentDeleteDialog
                open={deleteConfirmOpen}
                onOpenChange={setDeleteConfirmOpen}
                onConfirm={() => onDelete(event.databaseId)}
            />
        </>
    );
}
