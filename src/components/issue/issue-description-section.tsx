"use client";

import { Lock } from "lucide-react";
import { useState } from "react";
import { Async } from "~/components/async";
import { AuthorLabel } from "~/components/comment/author-label";
import {
    EditableDescriptionCard,
    EditableTitleRow,
} from "~/components/description/editable-content";
import { IssueStatusPill } from "~/components/issue/issue-status-pill";
import type { PullRequestPermissionContext } from "~/components/permissions/permissions-utils";
import { useOptimisticTextEditor } from "~/hooks/use-optimistic-text-editor";
import { useTaskToggle } from "~/hooks/use-task-toggle";
import type { IssueDetail } from "~/server/api/routers/issues/types";
import { api } from "~/trpc/react";
import { formatDateTime, formatRelativeTime } from "~/utils/format-time";
import type { Provider } from "~/utils/provider-url";

interface IssueDescriptionSectionProps {
    provider: Provider;
    owner: string;
    repo: string;
    number: number;
    issuePromise: Promise<IssueDetail>;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
}

export function IssueDescriptionSection({
    provider,
    owner,
    repo,
    number,
    issuePromise,
    permissionContextPromise,
}: IssueDescriptionSectionProps) {
    const bodyEditor = useOptimisticTextEditor(
        `issue-autosave:desc-body:${provider}:${owner}:${repo}:${number}`,
    );
    const updateMutation = api.issues.updateBody.useMutation({
        onMutate: bodyEditor.applySave,
        onError: bodyEditor.rollbackSave,
        onSuccess: bodyEditor.finishSave,
    });
    const taskToggleMutation = api.issues.updateBody.useMutation({
        onMutate: ({ body }) => bodyEditor.setSavedValue(body),
        onError: () => bodyEditor.setSavedValue(null),
    });
    const { onToggleTask } = useTaskToggle({
        mutation: taskToggleMutation,
        staticInput: { provider, owner, repo, issueNumber: number },
    });

    const [menuOpen, setMenuOpen] = useState(false);

    const { data: reactionsData } = api.reactions.getForIssue.useQuery(
        { provider, owner, repo, issueNumber: number },
        { staleTime: 30_000 },
    );

    return (
        <div data-testid="issue-description">
            {/* Issue Header */}
            <div className="mb-3">
                <IssueTitleRow
                    provider={provider}
                    owner={owner}
                    repo={repo}
                    number={number}
                    issuePromise={issuePromise}
                    permissionContextPromise={permissionContextPromise}
                />
                <IssueSubtitleRow
                    issuePromise={issuePromise}
                    provider={provider}
                />
            </div>

            <Async
                fallback={
                    <div className="h-48 w-fill animate-pulse rounded bg-surface-selected" />
                }
                promise={issuePromise}
            >
                {(issue) => (
                    <Async
                        fallback={
                            <div className="h-48 w-fill animate-pulse rounded bg-surface-selected" />
                        }
                        promise={permissionContextPromise}
                    >
                        {(permissionContext) => (
                            <EditableDescriptionCard
                                owner={owner}
                                repo={repo}
                                number={number}
                                provider={provider}
                                kind="issue"
                                body={issue.body}
                                authorAssociation={issue.authorAssociation}
                                permissionContextPromise={
                                    permissionContextPromise
                                }
                                isCurrentUser={
                                    permissionContext.isPullRequestAuthor
                                }
                                reactionsData={reactionsData}
                                editor={bodyEditor}
                                menuOpen={menuOpen}
                                onMenuOpenChange={setMenuOpen}
                                onSave={() =>
                                    updateMutation.mutate({
                                        provider,
                                        owner,
                                        repo,
                                        issueNumber: number,
                                        body: bodyEditor.editValue,
                                    })
                                }
                                onToggleTask={onToggleTask}
                            />
                        )}
                    </Async>
                )}
            </Async>
        </div>
    );
}

function IssueTitleRow({
    provider,
    owner,
    repo,
    number,
    issuePromise,
    permissionContextPromise,
}: {
    provider: Provider;
    owner: string;
    repo: string;
    number: number;
    issuePromise: Promise<IssueDetail>;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
}) {
    const editor = useOptimisticTextEditor(
        `issue-autosave:desc-title:${provider}:${owner}:${repo}:${number}`,
    );
    const updateMutation = api.issues.updateTitle.useMutation({
        onMutate: editor.applySave,
        onError: editor.rollbackSave,
        onSuccess: editor.finishSave,
    });

    return (
        <EditableTitleRow
            owner={owner}
            repo={repo}
            number={number}
            provider={provider}
            itemPromise={issuePromise}
            permissionContextPromise={permissionContextPromise}
            editor={editor}
            onSave={() =>
                updateMutation.mutate({
                    provider,
                    owner,
                    repo,
                    issueNumber: number,
                    title: editor.editValue,
                })
            }
            renderStatus={(issue) => (
                <>
                    <IssueStatusPill
                        state={issue.state}
                        stateReason={issue.stateReason}
                    />
                    {issue.locked && (
                        <span className="flex items-center gap-1 rounded-md border border-border bg-surface-secondary px-2 py-0.5 text-text-tertiary text-xs">
                            <Lock size={12} />
                            Locked
                        </span>
                    )}
                </>
            )}
        />
    );
}

function IssueSubtitleRow({
    issuePromise,
    provider,
}: {
    issuePromise: Promise<IssueDetail>;
    provider: Provider;
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
                            username={issue.author?.login ?? "ghost"}
                            avatarUrl={issue.author?.avatarUrl ?? ""}
                            profileUrl={issue.author?.profileUrl ?? "#"}
                            provider={provider}
                        />
                        <span title={formatDateTime(issue.createdAt)}>
                            {formatRelativeTime(issue.createdAt)}
                        </span>
                    </div>
                </div>
            )}
        </Async>
    );
}
