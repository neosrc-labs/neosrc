"use client";

import {
    ChevronDown,
    CircleX,
    File,
    FilePen,
    GitMerge,
    GitPullRequest,
    Undo2,
    X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Async } from "~/components/async";
import { MarkdownEditor } from "~/components/markdown/MarkdownEditor";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import { useLocalStorage } from "~/hooks/use-local-storage";
import type { MergeMethod, PullsGetResponseData } from "~/server/github";
import { api } from "~/trpc/react";

interface ActionSectionProps {
    owner: string;
    repo: string;
    number: number;
    pullRequestPromise: Promise<PullsGetResponseData> | null;
    conflictedFilesPromise?: Promise<string[]> | null;
    userPermissionPromise?: Promise<string | null> | null;
    currentUserLogin?: string;
}

export function ActionSection({
    owner,
    repo,
    number,
    pullRequestPromise,
    conflictedFilesPromise,
    userPermissionPromise,
    currentUserLogin,
}: ActionSectionProps) {
    const router = useRouter();
    const utils = api.useUtils();
    const [markedReady, setMarkedReady] = useState(false);
    const [convertedToDraft, setConvertedToDraft] = useState(false);
    const [isMerged, setIsMerged] = useState(false);
    const [body, setBody] = useState("");
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [isCancelPopoverOpen, setIsCancelPopoverOpen] = useState(false);
    const [isClosePopoverOpen, setIsClosePopoverOpen] = useState(false);
    const [isMergeOptionsOpen, setIsMergeOptionsOpen] = useState(false);
    const [isRevertPopoverOpen, setIsRevertPopoverOpen] = useState(false);
    const [revertTitle, setRevertTitle] = useState("");
    const [revertBody, setRevertBody] = useState("");
    const [revertDraft, setRevertDraft] = useState(false);
    const [mergeMode, setMergeMode] = useLocalStorage<MergeMethod>(
        "neosrc-merge-mode",
        "merge",
    );

    const { data: pendingReview } = api.reviews.getPending.useQuery(
        { owner, repo, number },
        { staleTime: 30_000 },
    );

    const { data: repoData } = api.repos.getByOwnerAndRepo.useQuery({
        provider: "gh",
        owner,
        repo,
    });

    const navigateAndScroll = useCallback(() => {
        router.push(`/gh/${owner}/${repo}/pull/${number}?scrollTo=bottom`);
    }, [router, owner, repo, number]);

    const approveMutation = api.pulls.approve.useMutation({
        onSuccess: () => {
            utils.timeline.list.invalidate();
            utils.reviews.getPending.invalidate();
            navigateAndScroll();
        },
    });

    const submitReviewMutation = api.reviews.submit.useMutation({
        onSuccess: () => {
            utils.reviews.getPending.invalidate();
            utils.reviewComments.list.invalidate();
            utils.timeline.list.invalidate();
            navigateAndScroll();
        },
    });

    const dismissReviewMutation = api.reviews.dismiss.useMutation({
        onSuccess: () => {
            utils.reviews.getPending.invalidate();
            utils.reviewComments.list.invalidate();
        },
    });

    const markAsDraftMutation = api.pulls.markAsDraft.useMutation({
        onSuccess: () => {
            setConvertedToDraft(true);
            utils.timeline.list.invalidate();
            utils.reviews.getPending.invalidate();
            router.refresh();
        },
    });

    const closeMutation = api.pulls.close.useMutation({
        onSuccess: () => {
            utils.timeline.list.invalidate();
            utils.reviews.getPending.invalidate();
            router.refresh();
        },
    });

    const reopenMutation = api.pulls.reopen.useMutation({
        onSuccess: () => {
            utils.timeline.list.invalidate();
            utils.reviews.getPending.invalidate();
            router.refresh();
        },
    });

    const markReadyMutation = api.pulls.markReadyForReview.useMutation({
        onSuccess: () => {
            setMarkedReady(true);
            utils.timeline.list.invalidate();
            utils.reviews.getPending.invalidate();
            router.refresh();
        },
    });

    const mergeMutation = api.pulls.merge.useMutation({
        onSuccess: () => {
            setIsMerged(true);
            utils.timeline.list.invalidate();
            utils.reviews.getPending.invalidate();
            router.refresh();
            navigateAndScroll();
        },
    });

    const revertMutation = api.pulls.revert.useMutation({
        onSuccess: (data) => {
            setIsRevertPopoverOpen(false);
            utils.timeline.list.invalidate();
            utils.reviews.getPending.invalidate();
            router.push(
                `/gh/${owner}/${repo}/pull/${data.revertPullRequest.number}`,
            );
        },
    });

    const handleSubmitAction = useCallback(
        (event: "APPROVE" | "COMMENT" | "REQUEST_CHANGES") => {
            const cleanup = () => {
                setIsPopoverOpen(false);
                setBody("");
            };

            if (pendingReview) {
                submitReviewMutation.mutate(
                    {
                        owner,
                        repo,
                        number,
                        reviewId: pendingReview.reviewId,
                        event,
                        body: body || undefined,
                    },
                    {
                        onSuccess: cleanup,
                    },
                );
            } else {
                approveMutation.mutate(
                    { owner, repo, number, event, body: body || undefined },
                    { onSuccess: cleanup },
                );
            }
        },
        [
            owner,
            repo,
            number,
            pendingReview,
            body,
            approveMutation,

            submitReviewMutation,
        ],
    );

    const handleCancelReview = useCallback(() => {
        if (!pendingReview) return;
        dismissReviewMutation.mutate({
            owner,
            repo,
            number,
            reviewId: pendingReview.reviewId,
        });
    }, [owner, repo, number, pendingReview, dismissReviewMutation]);

    const handleMarkAsDraft = useCallback(() => {
        markAsDraftMutation.mutate({ owner, repo, number });
    }, [owner, repo, number, markAsDraftMutation]);

    const handleClose = useCallback(() => {
        closeMutation.mutate({ owner, repo, number });
    }, [owner, repo, number, closeMutation]);

    const handleReopen = useCallback(() => {
        reopenMutation.mutate({ owner, repo, number });
    }, [owner, repo, number, reopenMutation]);

    const handleMarkReady = useCallback(() => {
        markReadyMutation.mutate({ owner, repo, number });
    }, [owner, repo, number, markReadyMutation]);

    const openRevertDialog = useCallback(
        (pullRequest: PullsGetResponseData) => {
            setRevertTitle(`Revert "${pullRequest.title}"`);
            setRevertBody(`Reverts ${owner}/${repo}#${number}`);
            setRevertDraft(false);
            setIsRevertPopoverOpen(true);
        },
        [owner, repo, number],
    );

    const handleRevert = useCallback(() => {
        revertMutation.mutate({
            owner,
            repo,
            number,
            title: revertTitle || undefined,
            body: revertBody || undefined,
            draft: revertDraft || undefined,
        });
    }, [
        owner,
        repo,
        number,
        revertTitle,
        revertBody,
        revertDraft,
        revertMutation,
    ]);

    const skeleton = (
        <>
            <div className="h-9 w-full animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-9 w-full animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-9 w-full animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
        </>
    );

    const pendingCommentsCount = pendingReview?.comments.length ?? 0;

    const reviewInProgress = pendingReview != null && (
        <div className="space-y-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900/50 dark:bg-yellow-900/10">
            <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-yellow-800 dark:text-yellow-400">
                    Review in progress
                </span>
                <Popover
                    open={isCancelPopoverOpen}
                    onOpenChange={setIsCancelPopoverOpen}
                >
                    <PopoverTrigger asChild>
                        <button
                            suppressHydrationWarning
                            className="cursor-pointer text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300"
                            disabled={dismissReviewMutation.isPending}
                            type="button"
                            title="Cancel review"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="end"
                        className="w-64 bg-surface p-4"
                        side="top"
                        sideOffset={4}
                    >
                        <p className="mb-3 font-medium text-sm text-text-primary">
                            Delete this pending review?
                        </p>
                        <p className="mb-4 text-text-secondary text-xs">
                            Your pending comments will be discarded.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                className="cursor-pointer rounded-md bg-surface-elevated px-3 py-1.5 font-medium text-text-label text-xs ring-1 ring-ring transition-colors hover:bg-gray-50 dark:hover:bg-zinc-700"
                                onClick={() => setIsCancelPopoverOpen(false)}
                                type="button"
                            >
                                Keep editing
                            </button>
                            <button
                                className="cursor-pointer rounded-md bg-red-600 px-3 py-1.5 font-medium text-white text-xs transition-colors hover:bg-red-700"
                                onClick={() => {
                                    setIsCancelPopoverOpen(false);
                                    handleCancelReview();
                                }}
                                type="button"
                            >
                                Delete review
                            </button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
            <p className="text-xs text-yellow-700 dark:text-yellow-500">
                {pendingCommentsCount} comment
                {pendingCommentsCount !== 1 ? "s" : ""} pending
            </p>
            {dismissReviewMutation.isPending && (
                <p className="text-xs text-yellow-700 dark:text-yellow-500">
                    Cancelling review...
                </p>
            )}
            {dismissReviewMutation.isError && (
                <p className="text-red-600 text-xs">
                    Failed to cancel review. Please try again.
                </p>
            )}
            {submitReviewMutation.isError && (
                <p className="text-red-600 text-xs">
                    Failed to submit review. Please try again.
                </p>
            )}
        </div>
    );

    const buttons = (
        pullRequest: PullsGetResponseData,
        conflictedFiles: string[],
        userPermission: string | null,
    ) => {
        const isDraft = !!pullRequest.draft && !markedReady;
        const effectiveMerged = pullRequest.merged || isMerged;
        const isAuthor = currentUserLogin === pullRequest.user?.login;
        const isPending =
            submitReviewMutation.isPending ||
            approveMutation.isPending ||
            approveMutation.isPending;

        const canWrite =
            userPermission === "admin" || userPermission === "write";
        const canManagePR = isAuthor || canWrite;
        const canMerge = canWrite;
        const canInteract = !pullRequest.locked || canWrite || isAuthor;
        const isMergeBlocked = pullRequest.mergeable_state === "blocked";
        const isMergeStateUnknown = pullRequest.mergeable_state === "unknown";

        const mergeOptionDefs = [
            {
                value: "merge" as const,
                label: "Create a merge commit",
                description:
                    "All commits will be added to the base branch via a merge commit.",
                allowed: repoData?.allowMergeCommit !== false,
            },
            {
                value: "squash" as const,
                label: "Squash and merge",
                description:
                    "All commits will be squashed into a single commit.",
                allowed: repoData?.allowSquashMerge !== false,
            },
            {
                value: "rebase" as const,
                label: "Rebase and merge",
                description:
                    "All commits will be added to the base branch individually.",
                allowed: repoData?.allowRebaseMerge !== false,
            },
        ];
        const availableMergeOptions = mergeOptionDefs.filter((o) => o.allowed);
        const noMergeMethodsAvailable = availableMergeOptions.length === 0;
        const effectiveMergeMode = availableMergeOptions.some(
            (o) => o.value === mergeMode,
        )
            ? mergeMode
            : (availableMergeOptions[0]?.value ?? "merge");

        const conflictedFilesSection =
            conflictedFiles.length > 0 ? (
                <div className="space-y-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900/50 dark:bg-yellow-900/10">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-yellow-800 dark:text-yellow-400">
                            Conflicting files
                        </span>
                    </div>
                    <ul className="space-y-1">
                        {conflictedFiles.map((file) => (
                            <li
                                key={file}
                                className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-yellow-700 dark:text-yellow-500"
                            >
                                <File size={12} className="shrink-0" />
                                <span className="truncate">{file}</span>
                            </li>
                        ))}
                    </ul>
                    {pullRequest.head.repo?.full_name ===
                        pullRequest.base.repo?.full_name && (
                        <a
                            href={`https://github.com/${owner}/${repo}/pull/${number}/conflicts`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-yellow-300 bg-yellow-100 px-3 py-1.5 font-medium text-xs text-yellow-800 transition-colors hover:bg-yellow-200 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50"
                        >
                            <FilePen size={12} />
                            Resolve
                        </a>
                    )}
                </div>
            ) : null;

        return (
            <>
                {conflictedFilesSection}
                {reviewInProgress}
                <div className="flex gap-1">
                    {!effectiveMerged &&
                        canManagePR &&
                        !pullRequest.draft &&
                        !convertedToDraft &&
                        pullRequest.state === "open" && (
                            <button
                                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-tertiary dark:border-zinc-600"
                                disabled={markAsDraftMutation.isPending}
                                onClick={() => handleMarkAsDraft()}
                                type="button"
                            >
                                <FilePen size={14} />
                                {markAsDraftMutation.isPending
                                    ? "Converting..."
                                    : "Mark as draft"}
                            </button>
                        )}
                    {!effectiveMerged &&
                    pullRequest.state === "open" &&
                    canManagePR ? (
                        <Popover
                            open={isClosePopoverOpen}
                            onOpenChange={setIsClosePopoverOpen}
                        >
                            <PopoverTrigger asChild>
                                <button
                                    suppressHydrationWarning
                                    className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-tertiary dark:border-zinc-600"
                                    disabled={closeMutation.isPending}
                                    type="button"
                                >
                                    <CircleX
                                        className="text-red-500"
                                        size={14}
                                    />
                                    {closeMutation.isPending
                                        ? "Closing..."
                                        : "Close"}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent
                                align="end"
                                className="w-64 bg-surface p-4"
                                side="top"
                                sideOffset={4}
                            >
                                <p className="mb-3 font-medium text-sm text-text-primary">
                                    Close this pull request?
                                </p>
                                <p className="mb-4 text-text-secondary text-xs">
                                    This can be undone by reopening it later.
                                </p>
                                <div className="flex justify-end gap-2">
                                    <button
                                        className="cursor-pointer rounded-md bg-surface-elevated px-3 py-1.5 font-medium text-text-label text-xs ring-1 ring-ring transition-colors hover:bg-gray-50 dark:hover:bg-zinc-700"
                                        onClick={() =>
                                            setIsClosePopoverOpen(false)
                                        }
                                        type="button"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="cursor-pointer rounded-md bg-red-600 px-3 py-1.5 font-medium text-white text-xs transition-colors hover:bg-red-700"
                                        onClick={() => {
                                            setIsClosePopoverOpen(false);
                                            handleClose();
                                        }}
                                        type="button"
                                    >
                                        Close
                                    </button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    ) : !effectiveMerged &&
                      pullRequest.state === "closed" &&
                      !pullRequest.merged &&
                      canManagePR ? (
                        <button
                            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-green-300 px-3 py-2 text-green-600 text-sm transition-colors hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
                            disabled={reopenMutation.isPending}
                            onClick={() => handleReopen()}
                            type="button"
                        >
                            <GitPullRequest size={14} />
                            {reopenMutation.isPending
                                ? "Reopening..."
                                : "Reopen"}
                        </button>
                    ) : null}
                </div>
                {effectiveMerged && (
                    <div className="flex items-center gap-2">
                        <div className="flex flex-1 items-center justify-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2.5 dark:border-violet-900/50 dark:bg-violet-950/30">
                            <GitMerge
                                size={16}
                                className="text-violet-600 dark:text-violet-400"
                            />
                            <span className="font-medium text-sm text-violet-700 dark:text-violet-300">
                                Merged
                            </span>
                        </div>
                        {canWrite && canInteract ? (
                            <Popover
                                open={isRevertPopoverOpen}
                                onOpenChange={setIsRevertPopoverOpen}
                            >
                                <PopoverTrigger asChild>
                                    <button
                                        suppressHydrationWarning
                                        className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-tertiary dark:border-zinc-600"
                                        disabled={revertMutation.isPending}
                                        onClick={() =>
                                            openRevertDialog(pullRequest)
                                        }
                                        type="button"
                                    >
                                        <Undo2 size={14} />
                                        {revertMutation.isPending
                                            ? "Reverting..."
                                            : "Revert"}
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent
                                    align="end"
                                    className="w-[42rem] bg-surface p-4"
                                    side="top"
                                    sideOffset={8}
                                >
                                    <div className="mb-3 flex items-center gap-1.5">
                                        <Undo2
                                            size={14}
                                            className="text-text-label"
                                        />
                                        <span className="font-medium text-sm text-text-primary">
                                            Revert this pull request
                                        </span>
                                    </div>
                                    <p className="mb-3 text-text-secondary text-xs">
                                        A new pull request will be created that
                                        reverts the changes from{" "}
                                        <span className="font-mono">
                                            #{number}
                                        </span>
                                        .
                                    </p>
                                    <label
                                        className="mb-1 block font-medium text-text-label text-xs"
                                        htmlFor="revert-title-input"
                                    >
                                        Title
                                    </label>
                                    <input
                                        className="mb-3 w-full rounded-md border border-gray-300 bg-surface-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600"
                                        disabled={revertMutation.isPending}
                                        id="revert-title-input"
                                        onChange={(e) =>
                                            setRevertTitle(e.target.value)
                                        }
                                        type="text"
                                        value={revertTitle}
                                    />
                                    <label
                                        className="mb-1 block font-medium text-text-label text-xs"
                                        htmlFor="revert-body-input"
                                    >
                                        Body
                                    </label>
                                    <MarkdownEditor
                                        autoFocus
                                        disabled={revertMutation.isPending}
                                        minHeight="120px"
                                        onChange={setRevertBody}
                                        onCancel={() =>
                                            setIsRevertPopoverOpen(false)
                                        }
                                        owner={owner}
                                        placeholder="Describe the revert"
                                        repo={repo}
                                        cancelLabel="Cancel"
                                        value={revertBody}
                                        footerActions={[
                                            {
                                                label: revertMutation.isPending
                                                    ? "Reverting..."
                                                    : "Revert",
                                                onClick: () => handleRevert(),
                                                variant: "neutral",
                                                disabled:
                                                    revertMutation.isPending,
                                            },
                                        ]}
                                    />
                                    <label className="mt-2 flex items-center gap-2 text-text-secondary text-xs">
                                        <input
                                            checked={revertDraft}
                                            disabled={revertMutation.isPending}
                                            onChange={(e) =>
                                                setRevertDraft(e.target.checked)
                                            }
                                            type="checkbox"
                                        />
                                        Create as draft
                                    </label>
                                </PopoverContent>
                            </Popover>
                        ) : null}
                    </div>
                )}
                {markAsDraftMutation.isError && (
                    <p className="text-red-600 text-xs">
                        Failed to mark as draft. Please try again.
                    </p>
                )}
                {closeMutation.isError && (
                    <p className="text-red-600 text-xs">
                        Failed to close. Please try again.
                    </p>
                )}
                {reopenMutation.isError && (
                    <p className="text-red-600 text-xs">
                        Failed to reopen. Please try again.
                    </p>
                )}
                {canInteract &&
                    !isAuthor &&
                    !isPending &&
                    !dismissReviewMutation.isPending && (
                        <div className="flex gap-1">
                            <Popover
                                open={isPopoverOpen}
                                onOpenChange={setIsPopoverOpen}
                            >
                                <PopoverTrigger asChild>
                                    <button
                                        suppressHydrationWarning
                                        className="w-full cursor-pointer rounded-md bg-[#0969da] px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-[#0860ca]"
                                        type="button"
                                    >
                                        Submit Review
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent
                                    align="end"
                                    className="w-[42rem] bg-surface p-4"
                                    side="top"
                                    sideOffset={8}
                                >
                                    <MarkdownEditor
                                        autoFocus
                                        disabled={isPending}
                                        minHeight="150px"
                                        onChange={setBody}
                                        onCancel={() => {
                                            setIsPopoverOpen(false);
                                            setBody("");
                                        }}
                                        owner={owner}
                                        placeholder="Leave a review comment"
                                        repo={repo}
                                        cancelLabel="Cancel"
                                        value={body}
                                        footerActions={[
                                            {
                                                label: "Comment",
                                                onClick: () =>
                                                    handleSubmitAction(
                                                        "COMMENT",
                                                    ),
                                                variant: "neutral",
                                                disabled: (text: string) =>
                                                    !text.trim(),
                                            },
                                            {
                                                label: "Approve",
                                                onClick: () =>
                                                    handleSubmitAction(
                                                        "APPROVE",
                                                    ),
                                                variant: "approve",
                                            },
                                            {
                                                label: "Request Changes",
                                                onClick: () =>
                                                    handleSubmitAction(
                                                        "REQUEST_CHANGES",
                                                    ),
                                                variant: "danger",
                                            },
                                        ]}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    )}
                {!effectiveMerged && pullRequest.state === "open" && (
                    <div className="flex gap-2">
                        {isDraft && canManagePR ? (
                            <button
                                className="w-full cursor-pointer rounded-md bg-gray-200 px-3 py-2 font-medium text-gray-800 text-sm transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={markReadyMutation.isPending}
                                onClick={handleMarkReady}
                                type="button"
                            >
                                {markReadyMutation.isPending
                                    ? "Marking..."
                                    : "Mark as ready for review"}
                            </button>
                        ) : pullRequest.mergeable_state === "dirty" ? (
                            <div className="flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-surface-secondary px-3 py-2 dark:border-zinc-600">
                                <GitMerge size={14} className="text-red-500" />
                                <span className="font-medium text-sm text-text-secondary">
                                    Conflicts
                                </span>
                            </div>
                        ) : isMergeBlocked ? (
                            <div className="flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-surface-secondary px-3 py-2 dark:border-zinc-600">
                                <GitMerge
                                    size={14}
                                    className="text-text-muted"
                                />
                                <span className="font-medium text-sm text-text-muted">
                                    Merging is blocked
                                </span>
                            </div>
                        ) : isMergeStateUnknown ? (
                            <div className="flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-surface-secondary px-3 py-2 dark:border-zinc-600">
                                <GitMerge
                                    size={14}
                                    className="text-text-muted"
                                />
                                <span className="font-medium text-sm text-text-muted">
                                    Checking mergeability...
                                </span>
                            </div>
                        ) : noMergeMethodsAvailable ? (
                            <div className="flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-surface-secondary px-3 py-2 dark:border-zinc-600">
                                <GitMerge
                                    size={14}
                                    className="text-text-muted"
                                />
                                <span className="font-medium text-sm text-text-muted">
                                    Merging is not allowed for this repository
                                </span>
                            </div>
                        ) : !canMerge ? (
                            <div className="flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-surface-secondary px-3 py-2 dark:border-zinc-600">
                                <GitMerge
                                    size={14}
                                    className="text-text-muted"
                                />
                                <span className="font-medium text-sm text-text-muted">
                                    You don&apos;t have permission to merge
                                </span>
                            </div>
                        ) : (
                            <div className="flex flex-1">
                                <button
                                    className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-l-md bg-[#2da44e] px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-[#218838] disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={mergeMutation.isPending}
                                    onClick={() => {
                                        mergeMutation.mutate({
                                            owner,
                                            repo,
                                            number,
                                            mergeMethod: effectiveMergeMode,
                                        });
                                    }}
                                    type="button"
                                >
                                    <GitMerge size={14} />
                                    {mergeMutation.isPending
                                        ? "Merging..."
                                        : effectiveMergeMode === "squash"
                                          ? "Squash and merge"
                                          : effectiveMergeMode === "rebase"
                                            ? "Rebase and merge"
                                            : "Merge pull request"}
                                </button>
                                <Popover
                                    open={isMergeOptionsOpen}
                                    onOpenChange={setIsMergeOptionsOpen}
                                >
                                    <PopoverTrigger asChild>
                                        <button
                                            suppressHydrationWarning
                                            className="cursor-pointer rounded-r-md border-[#1a7f37] border-l bg-[#2da44e] px-2 py-2 text-white transition-colors hover:bg-[#218838] disabled:cursor-not-allowed disabled:opacity-50"
                                            disabled={mergeMutation.isPending}
                                            type="button"
                                            title="Merge options"
                                        >
                                            <ChevronDown className="h-4 w-4" />
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        align="end"
                                        className="w-72 bg-surface p-2"
                                        side="left"
                                        sideOffset={8}
                                    >
                                        <div className="space-y-1">
                                            {availableMergeOptions.map(
                                                (option) => (
                                                    <button
                                                        key={option.value}
                                                        className={`flex w-full items-start gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                                            effectiveMergeMode ===
                                                            option.value
                                                                ? "bg-surface-tertiary"
                                                                : "hover:bg-surface-secondary"
                                                        }`}
                                                        onClick={() => {
                                                            setMergeMode(
                                                                option.value,
                                                            );
                                                            setIsMergeOptionsOpen(
                                                                false,
                                                            );
                                                        }}
                                                        type="button"
                                                    >
                                                        <span
                                                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                                                                effectiveMergeMode ===
                                                                option.value
                                                                    ? "border-[#2da44e]"
                                                                    : "border-gray-300 dark:border-zinc-600"
                                                            }`}
                                                        >
                                                            {effectiveMergeMode ===
                                                                option.value && (
                                                                <span className="flex h-2 w-2 rounded-full bg-[#2da44e]" />
                                                            )}
                                                        </span>
                                                        <div>
                                                            <div
                                                                className={
                                                                    effectiveMergeMode ===
                                                                    option.value
                                                                        ? "font-medium text-text-primary"
                                                                        : "text-text-label"
                                                                }
                                                            >
                                                                {option.label}
                                                            </div>
                                                            <div className="text-text-tertiary text-xs">
                                                                {
                                                                    option.description
                                                                }
                                                            </div>
                                                        </div>
                                                    </button>
                                                ),
                                            )}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}
                    </div>
                )}
                {mergeMutation.isError && (
                    <p className="text-red-600 text-xs">
                        Failed to merge. Please try again.
                    </p>
                )}
                {revertMutation.isError && (
                    <p className="text-red-600 text-xs">
                        Failed to revert. Please try again.
                    </p>
                )}
                {approveMutation.isError && (
                    <p className="text-red-600 text-xs">
                        Failed to approve. Please try again.
                    </p>
                )}
                {markReadyMutation.isError && (
                    <p className="text-red-600 text-xs">
                        Failed to mark as ready. Please try again.
                    </p>
                )}
            </>
        );
    };

    return (
        <div className="sticky bottom-0 z-10 space-y-2 border-border-subtle border-t bg-surface pt-6 pr-4">
            {pullRequestPromise ? (
                <Async fallback={skeleton} promise={pullRequestPromise}>
                    {(pullRequest) => (
                        <Async
                            fallback={null}
                            promise={
                                conflictedFilesPromise ?? Promise.resolve([])
                            }
                        >
                            {(files) => (
                                <Async
                                    fallback={null}
                                    promise={
                                        userPermissionPromise ??
                                        Promise.resolve(null)
                                    }
                                >
                                    {(userPermission) =>
                                        buttons(
                                            pullRequest,
                                            files,
                                            userPermission,
                                        )
                                    }
                                </Async>
                            )}
                        </Async>
                    )}
                </Async>
            ) : (
                skeleton
            )}
        </div>
    );
}
