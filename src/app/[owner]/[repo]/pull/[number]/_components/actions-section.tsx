"use client";

import {
    ChevronDown,
    CircleX,
    File,
    FilePen,
    GitMerge,
    GitPullRequest,
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
    const [body, setBody] = useState("");
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [isCancelPopoverOpen, setIsCancelPopoverOpen] = useState(false);
    const [isClosePopoverOpen, setIsClosePopoverOpen] = useState(false);
    const [isMergeOptionsOpen, setIsMergeOptionsOpen] = useState(false);
    const [mergeMode, setMergeMode] = useLocalStorage<MergeMethod>(
        "neosrc-merge-mode",
        "merge",
    );

    const { data: pendingReview } = api.reviews.getPending.useQuery(
        { owner, repo, number },
        { staleTime: 30_000 },
    );

    const approveMutation = api.pulls.approve.useMutation({
        onSuccess: () => {
            utils.timeline.list.invalidate();
        },
    });

    const requestChangesMutation = api.pulls.approve.useMutation({
        onSuccess: () => {
            utils.timeline.list.invalidate();
        },
    });

    const submitReviewMutation = api.reviews.submit.useMutation({
        onSuccess: () => {
            utils.reviews.getPending.invalidate();
            utils.reviewComments.list.invalidate();
            utils.timeline.list.invalidate();
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
            router.refresh();
        },
    });

    const closeMutation = api.pulls.close.useMutation({
        onSuccess: () => {
            router.refresh();
        },
    });

    const reopenMutation = api.pulls.reopen.useMutation({
        onSuccess: () => {
            router.refresh();
        },
    });

    const markReadyMutation = api.pulls.markReadyForReview.useMutation({
        onSuccess: () => {
            setMarkedReady(true);
            router.refresh();
        },
    });

    const mergeMutation = api.pulls.merge.useMutation({
        onSuccess: () => {
            router.refresh();
            utils.timeline.list.invalidate();
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
            } else if (event === "APPROVE") {
                approveMutation.mutate(
                    { owner, repo, number, event, body: body || undefined },
                    { onSuccess: cleanup },
                );
            } else {
                requestChangesMutation.mutate(
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
            requestChangesMutation,
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

    const handleMerge = useCallback(() => {
        mergeMutation.mutate({ owner, repo, number, mergeMethod: mergeMode });
    }, [owner, repo, number, mergeMode, mergeMutation]);

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
                        className="w-64 bg-white p-4 dark:bg-zinc-950"
                        side="top"
                        sideOffset={4}
                    >
                        <p className="mb-3 font-medium text-gray-900 text-sm dark:text-gray-100">
                            Delete this pending review?
                        </p>
                        <p className="mb-4 text-gray-600 text-xs dark:text-gray-400">
                            Your pending comments will be discarded.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                className="cursor-pointer rounded-md bg-white px-3 py-1.5 font-medium text-gray-700 text-xs ring-1 ring-gray-300 transition-colors hover:bg-gray-50 dark:bg-zinc-800 dark:text-gray-300 dark:ring-zinc-600 dark:hover:bg-zinc-700"
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
        const isAuthor = currentUserLogin === pullRequest.user?.login;
        const isPending =
            submitReviewMutation.isPending ||
            approveMutation.isPending ||
            requestChangesMutation.isPending;

        const canMerge =
            userPermission === "admin" || userPermission === "write";
        const isMergeBlocked = pullRequest.mergeable_state === "blocked";
        const isMergeStateUnknown = pullRequest.mergeable_state === "unknown";

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
                                className="flex items-center gap-1.5 font-mono text-xs text-yellow-700 dark:text-yellow-500"
                            >
                                <File size={12} className="shrink-0" />
                                {file}
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
                    {!pullRequest.draft &&
                        !convertedToDraft &&
                        pullRequest.state === "open" && (
                            <button
                                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-gray-600 text-sm transition-colors hover:bg-gray-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
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
                    {pullRequest.state === "open" ? (
                        <Popover
                            open={isClosePopoverOpen}
                            onOpenChange={setIsClosePopoverOpen}
                        >
                            <PopoverTrigger asChild>
                                <button
                                    className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-gray-600 text-sm transition-colors hover:bg-gray-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
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
                                className="w-64 bg-white p-4 dark:bg-zinc-950"
                                side="top"
                                sideOffset={4}
                            >
                                <p className="mb-3 font-medium text-gray-900 text-sm dark:text-gray-100">
                                    Close this pull request?
                                </p>
                                <p className="mb-4 text-gray-600 text-xs dark:text-gray-400">
                                    This can be undone by reopening it later.
                                </p>
                                <div className="flex justify-end gap-2">
                                    <button
                                        className="cursor-pointer rounded-md bg-white px-3 py-1.5 font-medium text-gray-700 text-xs ring-1 ring-gray-300 transition-colors hover:bg-gray-50 dark:bg-zinc-800 dark:text-gray-300 dark:ring-zinc-600 dark:hover:bg-zinc-700"
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
                    ) : pullRequest.state === "closed" &&
                      !pullRequest.merged ? (
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
                {!isAuthor &&
                    !isPending &&
                    !dismissReviewMutation.isPending && (
                        <div className="flex gap-1">
                            <Popover
                                open={isPopoverOpen}
                                onOpenChange={setIsPopoverOpen}
                            >
                                <PopoverTrigger asChild>
                                    <button
                                        className="w-full cursor-pointer rounded-md bg-[#0969da] px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-[#0860ca]"
                                        type="button"
                                    >
                                        Submit Review
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent
                                    align="end"
                                    className="w-[42rem] bg-white p-4 dark:bg-zinc-950"
                                    side="top"
                                    sideOffset={8}
                                >
                                    <MarkdownEditor
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
                {pullRequest.state === "open" && (
                    <div className="flex gap-2">
                        {isDraft ? (
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
                            <div className="flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900">
                                <GitMerge size={14} className="text-red-500" />
                                <span className="font-medium text-gray-600 text-sm dark:text-zinc-400">
                                    Conflicts
                                </span>
                            </div>
                        ) : isMergeBlocked ? (
                            <div className="flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900">
                                <GitMerge size={14} className="text-gray-400" />
                                <span className="font-medium text-gray-400 text-sm dark:text-zinc-500">
                                    Merging is blocked
                                </span>
                            </div>
                        ) : isMergeStateUnknown ? (
                            <div className="flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900">
                                <GitMerge size={14} className="text-gray-400" />
                                <span className="font-medium text-gray-400 text-sm dark:text-zinc-500">
                                    Checking mergeability...
                                </span>
                            </div>
                        ) : !canMerge ? (
                            <div className="flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900">
                                <GitMerge size={14} className="text-gray-400" />
                                <span className="font-medium text-gray-400 text-sm dark:text-zinc-500">
                                    You don&apos;t have permission to merge
                                </span>
                            </div>
                        ) : (
                            <div className="flex flex-1">
                                <button
                                    className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-l-md bg-[#2da44e] px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-[#218838] disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={mergeMutation.isPending}
                                    onClick={handleMerge}
                                    type="button"
                                >
                                    <GitMerge size={14} />
                                    {mergeMutation.isPending
                                        ? "Merging..."
                                        : mergeMode === "squash"
                                          ? "Squash and merge"
                                          : mergeMode === "rebase"
                                            ? "Rebase and merge"
                                            : "Merge pull request"}
                                </button>
                                <Popover
                                    open={isMergeOptionsOpen}
                                    onOpenChange={setIsMergeOptionsOpen}
                                >
                                    <PopoverTrigger asChild>
                                        <button
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
                                        className="w-72 bg-white p-2 dark:bg-zinc-950"
                                        side="left"
                                        sideOffset={8}
                                    >
                                        <div className="space-y-1">
                                            {(
                                                [
                                                    {
                                                        value: "merge" as const,
                                                        label: "Create a merge commit",
                                                        description:
                                                            "All commits will be added to the base branch via a merge commit.",
                                                    },
                                                    {
                                                        value: "squash" as const,
                                                        label: "Squash and merge",
                                                        description:
                                                            "All commits will be squashed into a single commit.",
                                                    },
                                                    {
                                                        value: "rebase" as const,
                                                        label: "Rebase and merge",
                                                        description:
                                                            "All commits will be added to the base branch individually.",
                                                    },
                                                ] as const
                                            ).map((option) => (
                                                <button
                                                    key={option.value}
                                                    className={`flex w-full items-start gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                                        mergeMode ===
                                                        option.value
                                                            ? "bg-gray-100 dark:bg-zinc-800"
                                                            : "hover:bg-gray-50 dark:hover:bg-zinc-900"
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
                                                            mergeMode ===
                                                            option.value
                                                                ? "border-[#2da44e]"
                                                                : "border-gray-300 dark:border-zinc-600"
                                                        }`}
                                                    >
                                                        {mergeMode ===
                                                            option.value && (
                                                            <span className="flex h-2 w-2 rounded-full bg-[#2da44e]" />
                                                        )}
                                                    </span>
                                                    <div>
                                                        <div
                                                            className={
                                                                mergeMode ===
                                                                option.value
                                                                    ? "font-medium text-gray-900 dark:text-gray-100"
                                                                    : "text-gray-700 dark:text-gray-300"
                                                            }
                                                        >
                                                            {option.label}
                                                        </div>
                                                        <div className="text-gray-500 text-xs dark:text-gray-400">
                                                            {option.description}
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
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
                {approveMutation.isError && (
                    <p className="text-red-600 text-xs">
                        Failed to approve. Please try again.
                    </p>
                )}
                {requestChangesMutation.isError && (
                    <p className="text-red-600 text-xs">
                        Failed to request changes. Please try again.
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
        <div className="sticky bottom-0 z-10 space-y-2 border-gray-200 border-t bg-white pt-6 pr-4 dark:border-zinc-800 dark:bg-zinc-950">
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
