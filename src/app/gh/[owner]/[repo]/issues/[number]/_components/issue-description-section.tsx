"use client";

import { Lock, MoreVertical, SmilePlus, SquarePen } from "lucide-react";
import { useCallback, useState } from "react";
import { AuthorLabel } from "~/app/[owner]/[repo]/_components/author-label";
import {
    canEdit,
    canInteract,
    type PullRequestPermissionContext,
} from "~/app/[owner]/[repo]/_components/permissions-utils";
import { ReactionFooter } from "~/app/[owner]/[repo]/_components/reaction-footer";
import { Async } from "~/components/async";
import { CodeTitle } from "~/components/markdown/accessories/code-title";
import { MarkdownEditor } from "~/components/markdown/markdown-editor";
import { MarkdownRenderer } from "~/components/markdown/markdown-renderer";
import { RoleBadge } from "~/components/role-badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import { StatusPill } from "~/components/ui/status-pill";
import { readAutosave, useAutosave } from "~/hooks/use-autosave";
import { useTaskToggle } from "~/hooks/use-task-toggle";
import type { IssueGetResponseData } from "~/server/github";
import { api } from "~/trpc/react";
import { formatDateTime, formatRelativeTime } from "~/utils";

interface IssueDescriptionSectionProps {
    owner: string;
    repo: string;
    number: number;
    issuePromise: Promise<IssueGetResponseData>;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
}

export function IssueDescriptionSection({
    owner,
    repo,
    number,
    issuePromise,
    permissionContextPromise,
}: IssueDescriptionSectionProps) {
    const [isEditing, setIsEditing] = useState(false);
    const descBodyKey = `issue-autosave:desc-body:${owner}:${repo}:${number}`;
    const [editBody, setEditBody] = useState(
        () => readAutosave(descBodyKey) ?? "",
    );
    const { clear: clearDescBody } = useAutosave(descBodyKey, editBody);
    const [savedBody, setSavedBody] = useState<string | null>(null);
    const updateMutation = api.issues.updateBody.useMutation({
        onMutate: () => {
            setSavedBody(editBody);
            setIsEditing(false);
        },
        onError: () => {
            setSavedBody(null);
            setIsEditing(true);
        },
        onSuccess: () => {
            clearDescBody();
            setEditBody("");
        },
    });

    // Toggle instance for task-list checkbox clicks. Separate from
    // `updateMutation` because its onMutate/onError contract mirrors the
    // toggle flow rather than the edit-mode flow. Both share `savedBody` as
    // the optimistic overlay over `issue.body`; the two flows are never
    // active at the same time (toggles only fire while `!isEditing`).
    const taskToggleMutation = api.issues.updateBody.useMutation({
        onMutate: ({ body }) => setSavedBody(body),
        onError: () => setSavedBody(null),
    });
    const { onToggleTask } = useTaskToggle({
        mutation: taskToggleMutation,
        staticInput: { owner, repo, issueNumber: number },
    });

    const [menuOpen, setMenuOpen] = useState(false);

    const { data: reactionsData } = api.reactions.getForIssue.useQuery(
        { owner, repo, issueNumber: number },
        { staleTime: 30_000 },
    );

    const handleStartEdit = useCallback((currentBody: string) => {
        setEditBody((prev) => prev || currentBody);
        setIsEditing(true);
    }, []);

    const handleCancel = useCallback(() => {
        setIsEditing(false);
        setEditBody("");
    }, []);

    const handleSave = useCallback(() => {
        updateMutation.mutate({
            owner,
            repo,
            issueNumber: number,
            body: editBody,
        });
    }, [editBody, owner, repo, number, updateMutation]);

    return (
        <div data-testid="issue-description">
            {/* Issue Header */}
            <div className="mb-3">
                <IssueTitleRow
                    owner={owner}
                    repo={repo}
                    number={number}
                    issuePromise={issuePromise}
                    permissionContextPromise={permissionContextPromise}
                />
                <IssueSubtitleRow issuePromise={issuePromise} />
            </div>

            <Async
                fallback={
                    <div className="h-48 w-fill animate-pulse rounded bg-surface-selected" />
                }
                promise={issuePromise}
            >
                {(issue) => {
                    const displayBody = savedBody ?? issue.body;
                    return (
                        <div className="rounded-lg border border-border bg-surface-elevated">
                            <div className="flex items-center justify-between rounded-t-lg border-border border-b bg-surface-secondary px-4 py-2">
                                <h3 className="text-text-label">Description</h3>
                                <div className="flex items-center gap-0.5">
                                    <RoleBadge
                                        authorAssociation={
                                            issue.author_association
                                        }
                                    />
                                    <Async
                                        fallback={null}
                                        promise={permissionContextPromise}
                                    >
                                        {(permissionContext) =>
                                            !isEditing &&
                                            canInteract(permissionContext) ? (
                                                <Popover
                                                    open={menuOpen}
                                                    onOpenChange={setMenuOpen}
                                                >
                                                    <PopoverTrigger asChild>
                                                        <button
                                                            type="button"
                                                            aria-label="More options"
                                                            className="cursor-pointer rounded p-1 text-text-muted transition-colors hover:bg-surface-tertiary hover:text-text-secondary dark:hover:text-zinc-300"
                                                        >
                                                            <MoreVertical
                                                                size={14}
                                                            />
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent
                                                        className="w-44 bg-surface p-1"
                                                        align="end"
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                handleStartEdit(
                                                                    savedBody ??
                                                                        issue.body ??
                                                                        "",
                                                                );
                                                                setMenuOpen(
                                                                    false,
                                                                );
                                                            }}
                                                            className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-text-label transition-colors hover:bg-surface-tertiary"
                                                        >
                                                            <SquarePen
                                                                size={14}
                                                            />
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
                                {isEditing ? (
                                    <MarkdownEditor
                                        autoFocus
                                        onCancel={handleCancel}
                                        onChange={setEditBody}
                                        value={editBody}
                                        owner={owner}
                                        repo={repo}
                                        minHeight="200px"
                                        footerActions={[
                                            {
                                                label: "Save",
                                                onClick: () => handleSave(),
                                                variant: "approve",
                                            },
                                        ]}
                                    />
                                ) : (
                                    <div>
                                        {displayBody ? (
                                            <Async
                                                fallback={
                                                    <MarkdownRenderer
                                                        content={displayBody}
                                                        owner={owner}
                                                        repo={repo}
                                                    />
                                                }
                                                promise={
                                                    permissionContextPromise
                                                }
                                            >
                                                {(permissionContext) => (
                                                    <MarkdownRenderer
                                                        canToggleTasks={canEdit(
                                                            permissionContext,
                                                        )}
                                                        content={displayBody}
                                                        onToggleTask={
                                                            onToggleTask
                                                        }
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
                                )}
                            </div>
                            {!isEditing && (
                                <Async
                                    fallback={
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
                                    }
                                    promise={permissionContextPromise}
                                >
                                    {(permissionContext) => (
                                        <ReactionFooter
                                            owner={owner}
                                            repo={repo}
                                            number={number}
                                            kind="issue"
                                            provider="gh"
                                            reactionsData={reactionsData}
                                            permissionContext={
                                                permissionContext
                                            }
                                        />
                                    )}
                                </Async>
                            )}
                        </div>
                    );
                }}
            </Async>
        </div>
    );
}

function IssueTitleRow({
    owner,
    repo,
    number,
    issuePromise,
    permissionContextPromise,
}: {
    owner: string;
    repo: string;
    number: number;
    issuePromise: Promise<IssueGetResponseData>;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
}) {
    const titleKey = `issue-autosave:desc-title:${owner}:${repo}:${number}`;
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitle, setEditTitle] = useState(
        () => readAutosave(titleKey) ?? "",
    );
    const [savedTitle, setSavedTitle] = useState<string | null>(null);
    const { clear: clearTitle } = useAutosave(titleKey, editTitle);

    const updateTitleMutation = api.issues.updateTitle.useMutation({
        onMutate: () => {
            setSavedTitle(editTitle);
            setIsEditingTitle(false);
        },
        onError: () => {
            setSavedTitle(null);
            setIsEditingTitle(true);
        },
        onSuccess: () => {
            clearTitle();
            setEditTitle("");
        },
    });

    const handleStartEditTitle = useCallback((currentTitle: string) => {
        setEditTitle((prev) => prev || currentTitle);
        setIsEditingTitle(true);
    }, []);

    const handleCancelTitle = useCallback(() => {
        setIsEditingTitle(false);
        setEditTitle("");
    }, []);

    const handleSaveTitle = useCallback(() => {
        updateTitleMutation.mutate({
            owner,
            repo,
            issueNumber: number,
            title: editTitle,
        });
    }, [editTitle, owner, repo, number, updateTitleMutation]);

    return (
        <div className="flex items-center gap-2">
            <Async
                fallback={
                    <div className="h-5 w-16 animate-pulse rounded-full bg-surface-selected" />
                }
                promise={issuePromise}
            >
                {(issue) => (
                    <>
                        <StatusPill
                            state={issue.state === "open" ? "open" : "closed"}
                        />
                        {issue.locked && (
                            <span className="flex items-center gap-1 rounded-md border border-border bg-surface-secondary px-2 py-0.5 text-text-tertiary text-xs">
                                <Lock size={12} />
                                Locked
                            </span>
                        )}
                    </>
                )}
            </Async>
            <Async
                fallback={
                    <div className="h-10 w-3/4 animate-pulse rounded bg-surface-selected" />
                }
                promise={issuePromise}
            >
                {(issue) => {
                    const displayTitle = savedTitle ?? issue.title;
                    return (
                        <div className="flex w-full items-center gap-2">
                            {isEditingTitle ? (
                                <>
                                    <input
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) =>
                                            setEditTitle(e.target.value)
                                        }
                                        className="flex-1 border-blue-500 border-b-2 bg-transparent font-bold text-2xl text-text-primary outline-none"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter")
                                                handleSaveTitle();
                                            if (e.key === "Escape")
                                                handleCancelTitle();
                                        }}
                                    />
                                    <button
                                        className="cursor-pointer rounded bg-green-600 px-2 py-1 text-white text-xs hover:bg-green-700"
                                        onClick={handleSaveTitle}
                                        type="button"
                                    >
                                        Save
                                    </button>
                                    <button
                                        className="cursor-pointer text-text-muted text-xs hover:text-text-secondary dark:hover:text-zinc-300"
                                        onClick={handleCancelTitle}
                                        type="button"
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <>
                                    <h1 className="font-medium text-3xl text-text-primary">
                                        <CodeTitle
                                            provider="gh"
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
                                                    className="cursor-pointer text-text-muted hover:text-text-secondary dark:hover:text-zinc-300"
                                                    onClick={() =>
                                                        handleStartEditTitle(
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
                                </>
                            )}
                        </div>
                    );
                }}
            </Async>
        </div>
    );
}
function IssueSubtitleRow({
    issuePromise,
}: {
    issuePromise: Promise<IssueGetResponseData>;
}) {
    return (
        <Async
            fallback={
                <div className="mt-2 h-6 w-104 animate-pulse rounded bg-surface-selected" />
            }
            promise={issuePromise}
        >
            {(issue) => (
                <div className="flex h-9 items-center gap-2">
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <span>Opened by</span>
                        <AuthorLabel
                            username={issue.user?.login ?? "ghost"}
                            avatarUrl={issue.user?.avatar_url ?? ""}
                            profileUrl={issue.user?.html_url ?? "#"}
                        />
                        <span title={formatDateTime(issue.created_at)}>
                            {formatRelativeTime(issue.created_at)}
                        </span>
                    </div>
                </div>
            )}
        </Async>
    );
}
