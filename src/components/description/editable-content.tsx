"use client";

import { MoreVertical, SmilePlus, SquarePen } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Async } from "~/components/async";
import { ReactionFooter } from "~/components/comment/reaction-footer";
import { CodeTitle } from "~/components/markdown/accessories/code-title";
import { MarkdownEditor } from "~/components/markdown/markdown-editor";
import { MarkdownRenderer } from "~/components/markdown/markdown-renderer";
import {
    canEdit,
    canInteract,
    type PullRequestPermissionContext,
} from "~/components/permissions/permissions-utils";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import { RoleBadge } from "~/components/user/role-badge";
import type { OptimisticTextEditor } from "~/hooks/use-optimistic-text-editor";
import type { Provider } from "~/utils/provider-url";

interface EditableDescriptionCardProps {
    owner: string;
    repo: string;
    number: number;
    provider: Provider;
    kind: "pull" | "issue";
    body: string | null;
    authorAssociation: string | null | undefined;
    isCurrentUser: boolean;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
    reactionsData: ComponentProps<typeof ReactionFooter>["reactionsData"];
    editor: OptimisticTextEditor;
    menuOpen: boolean;
    onMenuOpenChange: (open: boolean) => void;
    onSave: () => void;
    onToggleTask: (body: string) => void;
}

export function EditableDescriptionCard({
    owner,
    repo,
    number,
    provider,
    kind,
    body,
    authorAssociation,
    isCurrentUser,
    permissionContextPromise,
    reactionsData,
    editor,
    menuOpen,
    onMenuOpenChange,
    onSave,
    onToggleTask,
}: EditableDescriptionCardProps) {
    const displayBody = editor.savedValue ?? body ?? "";

    return (
        <div
            className={`rounded-lg border bg-surface-elevated ${
                isCurrentUser
                    ? "border-comment-current-border"
                    : "border-border"
            }`}
        >
            <div
                className={`flex items-center justify-between rounded-t-lg border-b px-4 py-2 ${
                    isCurrentUser
                        ? "border-comment-current-border bg-comment-current"
                        : "border-border bg-surface-secondary"
                }`}
            >
                <h3 className="text-text-label">Description</h3>
                <div className="flex items-center gap-0.5">
                    <RoleBadge authorAssociation={authorAssociation} />
                    <Async fallback={null} promise={permissionContextPromise}>
                        {(permissionContext) =>
                            !editor.isEditing &&
                            canInteract(permissionContext) ? (
                                <Popover
                                    open={menuOpen}
                                    onOpenChange={onMenuOpenChange}
                                >
                                    <PopoverTrigger asChild>
                                        <button
                                            type="button"
                                            aria-label="More options"
                                            className="cursor-pointer rounded p-1 text-text-muted transition-colors hover:bg-surface-tertiary hover:text-text-secondary"
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
                                                editor.startEditing(
                                                    displayBody,
                                                );
                                                onMenuOpenChange(false);
                                            }}
                                            className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-text-label transition-colors hover:bg-surface-tertiary"
                                        >
                                            <SquarePen size={14} />
                                            Edit
                                        </button>
                                    </PopoverContent>
                                </Popover>
                            ) : null
                        }
                    </Async>
                </div>
            </div>
            <div className="p-4">
                {editor.isEditing ? (
                    <MarkdownEditor
                        autoFocus
                        onCancel={editor.cancelEditing}
                        onChange={editor.setEditValue}
                        value={editor.editValue}
                        owner={owner}
                        repo={repo}
                        minHeight="200px"
                        footerActions={[
                            {
                                label: "Save",
                                onClick: onSave,
                                variant: "approve",
                            },
                        ]}
                    />
                ) : displayBody ? (
                    <Async
                        fallback={
                            <MarkdownRenderer
                                content={displayBody}
                                owner={owner}
                                repo={repo}
                            />
                        }
                        promise={permissionContextPromise}
                    >
                        {(permissionContext) => (
                            <MarkdownRenderer
                                canToggleTasks={canEdit(permissionContext)}
                                content={displayBody}
                                onToggleTask={onToggleTask}
                                owner={owner}
                                repo={repo}
                            />
                        )}
                    </Async>
                ) : (
                    <p className="text-text-tertiary italic">
                        No description provided.
                    </p>
                )}
            </div>
            {!editor.isEditing && (
                <Async
                    fallback={<ReactionFooterSkeleton />}
                    promise={permissionContextPromise}
                >
                    {(permissionContext) => (
                        <ReactionFooter
                            owner={owner}
                            repo={repo}
                            number={number}
                            kind={kind}
                            provider={provider}
                            reactionsData={reactionsData}
                            permissionContext={permissionContext}
                        />
                    )}
                </Async>
            )}
        </div>
    );
}

interface EditableTitleRowProps<T extends { title: string }> {
    owner: string;
    repo: string;
    number: number;
    provider: Provider;
    itemPromise: Promise<T>;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
    editor: OptimisticTextEditor;
    onSave: () => void;
    renderStatus: (item: T) => ReactNode;
    renderTrailing?: (item: T) => ReactNode;
}

export function EditableTitleRow<T extends { title: string }>({
    owner,
    repo,
    number,
    provider,
    itemPromise,
    permissionContextPromise,
    editor,
    onSave,
    renderStatus,
    renderTrailing,
}: EditableTitleRowProps<T>) {
    return (
        <div className="flex items-center gap-2">
            <Async
                fallback={
                    <div className="h-5 w-16 animate-pulse rounded-full bg-surface-selected" />
                }
                promise={itemPromise}
            >
                {renderStatus}
            </Async>
            <Async
                fallback={
                    <div className="h-10 w-3/4 animate-pulse rounded bg-surface-selected" />
                }
                promise={itemPromise}
            >
                {(item) => {
                    const displayTitle = editor.savedValue ?? item.title;
                    return (
                        <div className="flex w-full items-center gap-2">
                            {editor.isEditing ? (
                                <>
                                    <input
                                        type="text"
                                        value={editor.editValue}
                                        onChange={(event) =>
                                            editor.setEditValue(
                                                event.target.value,
                                            )
                                        }
                                        className="flex-1 border-focus border-b-2 bg-transparent font-bold text-2xl text-text-primary outline-none"
                                        autoFocus
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") onSave();
                                            if (event.key === "Escape") {
                                                editor.cancelEditing();
                                            }
                                        }}
                                    />
                                    <button
                                        className="cursor-pointer rounded bg-action px-2 py-1 text-action-foreground text-xs hover:bg-action-hover"
                                        onClick={onSave}
                                        type="button"
                                    >
                                        Save
                                    </button>
                                    <button
                                        className="cursor-pointer text-text-muted text-xs hover:text-text-secondary"
                                        onClick={editor.cancelEditing}
                                        type="button"
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <>
                                    <h1 className="font-medium text-3xl text-text-primary">
                                        <CodeTitle
                                            provider={provider}
                                            owner={owner}
                                            repo={repo}
                                        >
                                            {displayTitle}
                                        </CodeTitle>
                                    </h1>
                                    <span className="text-2xl text-text-muted">
                                        #{number}
                                    </span>
                                    <Async
                                        fallback={null}
                                        promise={permissionContextPromise}
                                    >
                                        {(permissionContext) =>
                                            canInteract(permissionContext) ? (
                                                <button
                                                    className="cursor-pointer text-text-muted hover:text-text-secondary"
                                                    onClick={() =>
                                                        editor.startEditing(
                                                            displayTitle,
                                                        )
                                                    }
                                                    type="button"
                                                >
                                                    <SquarePen size={16} />
                                                </button>
                                            ) : null
                                        }
                                    </Async>
                                    {renderTrailing?.(item)}
                                </>
                            )}
                        </div>
                    );
                }}
            </Async>
        </div>
    );
}

function ReactionFooterSkeleton() {
    return (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
            <button
                type="button"
                aria-hidden="true"
                tabIndex={-1}
                className="rounded p-1 opacity-0"
            >
                <SmilePlus size={14} />
            </button>
        </div>
    );
}
