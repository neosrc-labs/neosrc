"use client";

import type { components } from "@octokit/openapi-types";
import { MoreVertical, SquarePen, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
    canEdit,
    canInteract,
    type PullRequestPermissionContext,
} from "~/app/gh/[owner]/[repo]/pull/[number]/permissions-utils";
import type { ReactionContent } from "~/lib/reactions";
import type { ReviewCommentBase } from "~/server/github";
import { CommentCard } from "./comment-card";
import { MarkdownRenderer } from "./markdown/markdown-renderer";
import { ReactionBar } from "./reaction-bar";
import { ReactionPicker } from "./reaction-picker";
import { Button } from "./ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

type Reaction = components["schemas"]["reaction"];

export interface ReviewCommentItemProps {
    comment: ReviewCommentBase;
    placement: "parent" | "reply";
    threadId: string;
    displayBody: string;
    reactions: Reaction[];
    permissionContext: PullRequestPermissionContext;
    owner: string;
    repo: string;
    number: number;
    isPending: boolean;
    isOutdated: boolean;
    isStub: boolean;
    isEditing: boolean;
    editBody: string;
    /** Rendered in the card header, left of the role badge (parent threads only). */
    headerLeading?: ReactNode;
    onStartEdit: () => void;
    onEditBodyChange: (body: string) => void;
    onCancelEdit: () => void;
    onSaveEdit: () => void;
    onReact: (content: ReactionContent) => void;
    onDelete: () => void;
    onToggleTask: (body: string) => void;
}

export function ReviewCommentItem({
    comment,
    placement,
    threadId,
    displayBody,
    reactions,
    permissionContext,
    owner,
    repo,
    number,
    isPending,
    isOutdated,
    isStub,
    isEditing,
    editBody,
    headerLeading,
    onStartEdit,
    onEditBodyChange,
    onCancelEdit,
    onSaveEdit,
    onReact,
    onDelete,
    onToggleTask,
}: ReviewCommentItemProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    if (!comment.user) return null;

    const allowedToInteract = canInteract(permissionContext);
    const allowedToEdit = canEdit(permissionContext);
    const isAuthor = permissionContext.currentUser === comment.user.login;

    return (
        <>
            <CommentCard
                owner={owner}
                repo={repo}
                user={comment.user}
                userHref={comment.user.html_url}
                createdAt={comment.created_at}
                authorAssociation={comment.author_association}
                isPending={isPending}
                isOutdated={isOutdated}
                isEditing={isEditing}
                editBody={editBody}
                onEditBodyChange={onEditBodyChange}
                onCancelEdit={onCancelEdit}
                onSaveEdit={onSaveEdit}
                variant={placement === "parent" ? "default" : "nested"}
                headerLeading={headerLeading}
                headerActions={
                    <>
                        {(isAuthor || allowedToEdit) &&
                            allowedToInteract &&
                            !isStub && (
                                <button
                                    type="button"
                                    aria-label="Edit comment"
                                    className="cursor-pointer rounded p-1 text-text-muted transition-colors hover:bg-surface-tertiary hover:text-text-secondary dark:hover:text-zinc-300"
                                    onClick={onStartEdit}
                                >
                                    <SquarePen size={14} />
                                </button>
                            )}
                        {allowedToInteract && !isStub && (
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
                                            setMenuOpen(false);
                                            setDeleteConfirmOpen(true);
                                        }}
                                        className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-text-label transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                                    >
                                        <Trash2 size={14} />
                                        Delete comment
                                    </button>
                                </PopoverContent>
                            </Popover>
                        )}
                        {isStub && (
                            <span className="inline-flex animate-pulse items-center rounded p-1 font-medium text-text-muted text-xs">
                                Saving...
                            </span>
                        )}
                    </>
                }
                footer={
                    <div className="mx-6 flex flex-wrap items-center gap-1.5 px-4 pb-3">
                        {allowedToInteract && (
                            <>
                                <ReactionPicker
                                    disabled={isStub}
                                    reactions={reactions}
                                    currentUserLogin={
                                        permissionContext.currentUser
                                    }
                                    onReact={onReact}
                                />
                                <ReactionBar
                                    disabled={isStub}
                                    reactions={reactions}
                                    currentUserLogin={
                                        permissionContext.currentUser
                                    }
                                    onReact={onReact}
                                />
                            </>
                        )}
                    </div>
                }
            >
                <MarkdownRenderer
                    content={displayBody}
                    owner={owner}
                    repo={repo}
                    pullNumber={number}
                    commentPath={comment.path}
                    commentLine={comment.line}
                    commentStartLine={comment.start_line}
                    commentThreadId={threadId}
                    onToggleTask={onToggleTask}
                    canToggleTasks={
                        (isAuthor || allowedToEdit) &&
                        allowedToInteract &&
                        !isStub
                    }
                />
            </CommentCard>
            <Dialog
                open={deleteConfirmOpen}
                onOpenChange={setDeleteConfirmOpen}
            >
                <DialogContent showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle>Delete comment</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this comment? This
                            action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteConfirmOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                onDelete();
                                setDeleteConfirmOpen(false);
                            }}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
