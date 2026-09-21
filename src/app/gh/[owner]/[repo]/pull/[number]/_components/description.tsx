"use client";

import { Archive, Lock } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import {
    ActionErrorBanner,
    ActionErrorProvider,
} from "~/components/action-errors";
import { Async } from "~/components/async";
import { AuthorLabel } from "~/components/comment/author-label";
import {
    EditableDescriptionCard,
    EditableTitleRow,
} from "~/components/description/editable-content";
import type { PullRequestPermissionContext } from "~/components/permissions/permissions-utils";
import { CreateStackDialog } from "~/components/pull/stack/create-stack-dialog";
import { StackBanner } from "~/components/pull/stack/stack-banner";
import { StackCreateBadge } from "~/components/pull/stack/stack-create-badge";
import { StackBadge } from "~/components/pull/stack/stack-popover";
import {
    extractPullRequestState,
    StatusPill,
} from "~/components/ui/status-pill";
import { useLocalStorage } from "~/hooks/use-local-storage";
import { useOptimisticTextEditor } from "~/hooks/use-optimistic-text-editor";
import { useTaskToggle } from "~/hooks/use-task-toggle";
import type {
    PullRequestDetail,
    PullsGetResponseData,
    StackSuggestion,
} from "~/server/github";
import { api } from "~/trpc/react";
import { formatDateTime, formatRelativeTime } from "~/utils/format-time";
import { AutoMergeBannerSection } from "./action-bar/auto-merge-banner-section";
import { ConflictedFiles } from "./action-bar/conflicted-files";
import { AdditionsDeletionsBadge } from "./files/additions-deletions-badge";

interface PullRequestDescriptionSectionProps {
    owner: string;
    repo: string;
    number: number;
    pullRequestPromise: Promise<PullRequestDetail>;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
    actionSection?: ReactNode;
    conflictedFilesPromise?: Promise<string[]> | null;
    stackSuggestionPromise: Promise<StackSuggestion | null>;
}

export function PullRequestDescriptionSection({
    owner,
    repo,
    number,
    pullRequestPromise,
    permissionContextPromise,
    actionSection,
    conflictedFilesPromise,
    stackSuggestionPromise,
}: PullRequestDescriptionSectionProps) {
    const bodyEditor = useOptimisticTextEditor(
        `pr-autosave:desc-body:${owner}:${repo}:${number}`,
    );
    const [stackDialogOpen, setStackDialogOpen] = useState(false);
    const [stackBannerDismissed, setStackBannerDismissed] = useLocalStorage(
        `stack-banner-dismissed:${owner}:${repo}:${number}`,
        false,
    );
    const updateMutation = api.pulls.updateBody.useMutation({
        onMutate: bodyEditor.applySave,
        onError: bodyEditor.rollbackSave,
        onSuccess: bodyEditor.finishSave,
    });
    const taskToggleMutation = api.pulls.updateBody.useMutation({
        onMutate: ({ body }) => bodyEditor.setSavedValue(body),
        onError: () => bodyEditor.setSavedValue(null),
    });
    const { onToggleTask } = useTaskToggle({
        mutation: taskToggleMutation,
        staticInput: { owner, repo, number },
    });

    const [menuOpen, setMenuOpen] = useState(false);

    const { data: reactionsData } = api.reactions.get.useQuery(
        { owner, repo, number },
        { staleTime: 30_000 },
    );

    return (
        <div data-testid="pr-description">
            {/* PR Header */}
            <div className="mb-3">
                <TitleRow
                    owner={owner}
                    repo={repo}
                    number={number}
                    pullRequestPromise={pullRequestPromise}
                    permissionContextPromise={permissionContextPromise}
                />
                <ActionErrorProvider>
                    <SubtitleActionRow
                        owner={owner}
                        repo={repo}
                        pullRequestPromise={pullRequestPromise}
                        actionSection={actionSection}
                        stackSuggestionPromise={stackSuggestionPromise}
                        stackBannerDismissed={stackBannerDismissed}
                        onCreateStack={() => setStackDialogOpen(true)}
                    />
                    <ActionErrorBanner className="mt-3" />
                </ActionErrorProvider>
                {conflictedFilesPromise && (
                    <Async fallback={null} promise={pullRequestPromise}>
                        {(pullRequest) => (
                            <Async
                                fallback={null}
                                promise={conflictedFilesPromise}
                            >
                                {(files) =>
                                    files.length > 0 ? (
                                        <Async
                                            fallback={null}
                                            promise={permissionContextPromise}
                                        >
                                            {(permissionContext) => (
                                                <div className="mt-3">
                                                    <ConflictedFiles
                                                        owner={owner}
                                                        repo={repo}
                                                        number={number}
                                                        pullRequest={
                                                            pullRequest
                                                        }
                                                        conflictedFiles={files}
                                                        permissionContext={
                                                            permissionContext
                                                        }
                                                    />
                                                </div>
                                            )}
                                        </Async>
                                    ) : null
                                }
                            </Async>
                        )}
                    </Async>
                )}
            </div>

            <Async fallback={null} promise={stackSuggestionPromise}>
                {(suggestion) =>
                    suggestion ? (
                        <>
                            {!stackBannerDismissed && (
                                <div className="mb-3">
                                    <StackBanner
                                        suggestion={suggestion}
                                        onDismiss={() =>
                                            setStackBannerDismissed(true)
                                        }
                                        onCreateStack={() =>
                                            setStackDialogOpen(true)
                                        }
                                    />
                                </div>
                            )}
                            <CreateStackDialog
                                open={stackDialogOpen}
                                onOpenChange={setStackDialogOpen}
                                owner={owner}
                                repo={repo}
                                suggestion={suggestion}
                            />
                        </>
                    ) : null
                }
            </Async>
            <AutoMergeBannerSection pullRequestPromise={pullRequestPromise} />

            <Async
                fallback={
                    <div className="h-48 w-fill animate-pulse rounded bg-surface-selected" />
                }
                promise={pullRequestPromise}
            >
                {(pullRequest) => (
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
                                provider="gh"
                                kind="pull"
                                body={pullRequest.body}
                                authorAssociation={
                                    pullRequest.author_association
                                }
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
                                        owner,
                                        repo,
                                        number,
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

function TitleRow({
    owner,
    repo,
    number,
    pullRequestPromise,
    permissionContextPromise,
}: {
    owner: string;
    repo: string;
    number: number;
    pullRequestPromise: Promise<PullRequestDetail>;
    permissionContextPromise: Promise<PullRequestPermissionContext>;
}) {
    const editor = useOptimisticTextEditor(
        `pr-autosave:desc-title:${owner}:${repo}:${number}`,
    );
    const updateMutation = api.pulls.updateTitle.useMutation({
        onMutate: editor.applySave,
        onError: editor.rollbackSave,
        onSuccess: editor.finishSave,
    });

    return (
        <EditableTitleRow
            owner={owner}
            repo={repo}
            number={number}
            provider="gh"
            itemPromise={pullRequestPromise}
            permissionContextPromise={permissionContextPromise}
            editor={editor}
            onSave={() =>
                updateMutation.mutate({
                    owner,
                    repo,
                    number,
                    title: editor.editValue,
                })
            }
            renderStatus={(pullRequest) => (
                <>
                    <StatusPill state={extractPullRequestState(pullRequest)} />
                    {pullRequest.archived && (
                        <span className="flex items-center gap-1 rounded-md border border-border bg-surface-secondary px-2 py-0.5 text-text-tertiary text-xs">
                            <Archive size={12} />
                            Archived
                        </span>
                    )}
                    {pullRequest.locked && (
                        <span className="flex items-center gap-1 rounded-md border border-border bg-surface-secondary px-2 py-0.5 text-text-tertiary text-xs">
                            <Lock size={12} />
                            Locked
                        </span>
                    )}
                </>
            )}
            renderTrailing={(pullRequest) => (
                <AdditionsDeletionsBadge
                    additions={pullRequest.additions}
                    deletions={pullRequest.deletions}
                    className="ml-auto"
                />
            )}
        />
    );
}

function SubtitleActionRow({
    owner,
    repo,
    pullRequestPromise,
    actionSection,
    stackSuggestionPromise,
    stackBannerDismissed,
    onCreateStack,
}: {
    owner: string;
    repo: string;
    pullRequestPromise: Promise<PullsGetResponseData>;
    actionSection?: ReactNode;
    stackSuggestionPromise: Promise<StackSuggestion | null>;
    stackBannerDismissed: boolean;
    onCreateStack: () => void;
}) {
    return (
        <Async
            fallback={
                <div className="mt-2 h-6 w-104 animate-pulse rounded bg-surface-selected" />
            }
            promise={pullRequestPromise}
        >
            {(pullRequest) => (
                <div className="flex h-9 items-center gap-2">
                    <Branches
                        owner={owner}
                        repo={repo}
                        pullRequest={pullRequest}
                    />
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <OpenedByLabel />
                        <AuthorLabel
                            username={pullRequest.user?.login ?? "ghost"}
                            avatarUrl={pullRequest.user?.avatar_url ?? ""}
                            profileUrl={pullRequest.user?.html_url ?? "#"}
                            provider="gh"
                        />
                        <span title={formatDateTime(pullRequest.created_at)}>
                            {formatRelativeTime(pullRequest.created_at)}
                        </span>
                    </div>
                    {pullRequest.stack ? (
                        <StackBadge
                            owner={owner}
                            repo={repo}
                            prNumber={pullRequest.number}
                            stack={pullRequest.stack}
                        />
                    ) : stackBannerDismissed ? (
                        <Async fallback={null} promise={stackSuggestionPromise}>
                            {(suggestion) =>
                                suggestion ? (
                                    <StackCreateBadge onClick={onCreateStack} />
                                ) : null
                            }
                        </Async>
                    ) : null}
                    {actionSection && (
                        <div className="ml-auto flex items-center">
                            {actionSection}
                        </div>
                    )}
                </div>
            )}
        </Async>
    );
}

export function Branches({
    owner,
    repo,
    pullRequest,
}: {
    owner: string;
    repo: string;
    pullRequest: PullsGetResponseData;
}) {
    const baseRepo = pullRequest.base.repo?.full_name ?? `${owner}/${repo}`;
    const headRepo = pullRequest.head.repo?.full_name ?? `${owner}/${repo}`;
    const headLabel =
        headRepo === baseRepo ? pullRequest.head.ref : pullRequest.head.label;

    const branchLinkClassName =
        "rounded bg-info-surface px-1.5 py-0.5 font-mono text-info-text text-xs hover:bg-info-border/20";

    return (
        <div className="text-sm text-text-secondary">
            <a
                href={`https://github.com/${baseRepo}/tree/${pullRequest.base.ref}`}
                className={branchLinkClassName}
            >
                <span className="select-all">{pullRequest.base.ref}</span>
            </a>
            <span className="mx-2 text-text-tertiary" aria-hidden="true">
                ←
            </span>
            <a
                href={`https://github.com/${headRepo}/tree/${pullRequest.head.ref}`}
                className={branchLinkClassName}
            >
                <span className="select-all" title={pullRequest.head.label}>
                    {headLabel}
                </span>
            </a>
        </div>
    );
}

function OpenedByLabel() {
    const width = useMainSectionWidth();
    if (!width || width < 1000) return null;
    return <span>opened by </span>;
}

function useMainSectionWidth() {
    const [width, setWidth] = useState<number | null>(null);

    useEffect(() => {
        const main = document.querySelector("main");
        if (!main) return;

        const check = () => {
            setWidth(main.clientWidth);
        };

        check();
        const observer = new ResizeObserver(check);
        observer.observe(main);
        return () => observer.disconnect();
    }, []);

    return width;
}
