"use client";

import { ChevronDown, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Async } from "~/components/async";
import { MarkdownEditor } from "~/components/markdown/MarkdownEditor";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import type { PullsGetResponseData } from "~/server/github";
import { api } from "~/trpc/react";

interface ActionSectionProps {
    owner: string;
    repo: string;
    number: number;
    pullRequestPromise: Promise<PullsGetResponseData> | null;
    currentUserLogin?: string;
}

export function ActionSection({
    owner,
    repo,
    number,
    pullRequestPromise,
    currentUserLogin,
}: ActionSectionProps) {
    const router = useRouter();
    const utils = api.useUtils();
    const [markedReady, setMarkedReady] = useState(false);
    const [body, setBody] = useState("");
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [isCancelPopoverOpen, setIsCancelPopoverOpen] = useState(false);

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

    const markReadyMutation = api.pulls.markReadyForReview.useMutation({
        onSuccess: () => {
            setMarkedReady(true);
            router.refresh();
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

    const handleMarkReady = useCallback(() => {
        markReadyMutation.mutate({ owner, repo, number });
    }, [owner, repo, number, markReadyMutation]);

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

    const buttons = (pullRequest: PullsGetResponseData) => {
        const isDraft = !!pullRequest.draft && !markedReady;
        const isAuthor = currentUserLogin === pullRequest.user?.login;
        const isPending =
            submitReviewMutation.isPending ||
            approveMutation.isPending ||
            requestChangesMutation.isPending;

        return (
            <>
                {reviewInProgress}
                <div className="flex gap-1">
                    <Popover
                        open={isPopoverOpen}
                        onOpenChange={setIsPopoverOpen}
                    >
                        <PopoverTrigger asChild>
                            <button
                                className="w-full cursor-pointer rounded-md bg-[#0969da] px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-[#0860ca] disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={
                                    isAuthor ||
                                    isPending ||
                                    dismissReviewMutation.isPending
                                }
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
                                            handleSubmitAction("COMMENT"),
                                        variant: "neutral",
                                        disabled: (text: string) =>
                                            !text.trim(),
                                    },
                                    {
                                        label: "Approve",
                                        onClick: () =>
                                            handleSubmitAction("APPROVE"),
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
                    ) : (
                        <button
                            className="flex-1 cursor-not-allowed rounded-md bg-[#8250df] px-3 py-2 font-medium text-sm text-white opacity-50"
                            disabled
                            type="button"
                        >
                            Merge
                        </button>
                    )}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                className="cursor-pointer rounded-md bg-neutral-200 px-2 py-2 text-black transition-colors hover:bg-neutral-300 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled
                                type="button"
                                title="Merge options"
                            >
                                <ChevronDown className="h-4 w-4" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent
                            align="end"
                            className="w-48 bg-white p-2 dark:bg-zinc-950"
                            side="left"
                            sideOffset={8}
                        >
                            <p className="px-2 py-1 text-gray-500 text-xs">
                                Merge options coming soon
                            </p>
                        </PopoverContent>
                    </Popover>
                </div>
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
                    {(pullRequest) => buttons(pullRequest)}
                </Async>
            ) : (
                skeleton
            )}
        </div>
    );
}
