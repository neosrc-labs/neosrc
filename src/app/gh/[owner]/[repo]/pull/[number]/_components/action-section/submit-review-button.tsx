"use client";

import { useCallback, useState } from "react";
import { MarkdownEditor } from "~/components/markdown/markdown-editor";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import { readAutosave, useAutosave } from "~/hooks/use-autosave";
import type { PendingReview } from "~/server/api/routers/reviews";
import { api } from "~/trpc/react";

export function SubmitReviewButton({
    owner,
    repo,
    number,
    pendingReview,
    pendingCommentsCount,
    isDiscarding,
    navigateAndScroll,
    onDiscardReview,
    isAuthor,
}: {
    owner: string;
    repo: string;
    number: number;
    pendingReview?: PendingReview | null;
    pendingCommentsCount: number;
    isDiscarding: boolean;
    navigateAndScroll: () => void;
    onDiscardReview: () => void;
    isAuthor: boolean;
}) {
    const utils = api.useUtils();
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const reviewBodyKey = `pr-autosave:review-body:${owner}:${repo}:${number}`;
    const [body, setBody] = useState(() => readAutosave(reviewBodyKey) ?? "");
    const { clear: clearReviewBody } = useAutosave(reviewBodyKey, body);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

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

    const handleSubmitAction = useCallback(
        (event: "APPROVE" | "COMMENT" | "REQUEST_CHANGES") => {
            const cleanup = () => {
                setIsPopoverOpen(false);
                setBody("");
                setShowDiscardConfirm(false);
                clearReviewBody();
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
            clearReviewBody,
        ],
    );
    return (
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
                <button
                    suppressHydrationWarning
                    className="flex cursor-pointer items-center gap-1.5 text-nowrap rounded-md bg-[#0969da] px-1.5 py-2 font-medium text-white text-xs transition-colors hover:bg-[#0860ca] sm:px-3"
                    type="button"
                >
                    Submit Review
                    {pendingReview && pendingCommentsCount > 0 && (
                        <span className="inline-flex items-center justify-center rounded-full bg-white/20 px-1.5 py-0.5 font-bold text-2xs leading-none">
                            {pendingCommentsCount}
                        </span>
                    )}
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
                    disabled={false /* FIXME: do this */}
                    minHeight="150px"
                    onChange={setBody}
                    onCancel={() => {
                        setIsPopoverOpen(false);
                        setBody("");
                        setShowDiscardConfirm(false);
                    }}
                    owner={owner}
                    placeholder="Leave a review comment"
                    repo={repo}
                    cancelLabel="Cancel"
                    value={body}
                    footerActions={[
                        {
                            label: "Comment",
                            onClick: () => handleSubmitAction("COMMENT"),
                            variant: "neutral",
                            disabled: (text: string) => !text.trim(),
                        },
                        {
                            label: "Approve",
                            onClick: () => handleSubmitAction("APPROVE"),
                            variant: "approve",
                            disabled: isAuthor,
                        },
                        {
                            label: "Request Changes",
                            onClick: () =>
                                handleSubmitAction("REQUEST_CHANGES"),
                            variant: "danger",
                            disabled: isAuthor,
                        },
                    ]}
                />
                {pendingReview && (
                    <div className="mt-3 border-gray-200 border-t pt-3 dark:border-zinc-600">
                        {showDiscardConfirm ? (
                            <div>
                                <p className="mb-1 font-medium text-sm text-text-primary">
                                    Delete this pending review?
                                </p>
                                <p className="mb-3 text-text-secondary text-xs">
                                    Your pending comments will be discarded.
                                </p>
                                <div className="flex justify-end gap-2">
                                    <button
                                        className="cursor-pointer rounded-md bg-surface-elevated px-3 py-1.5 font-medium text-text-label text-xs ring-1 ring-ring transition-colors hover:bg-gray-50 dark:hover:bg-zinc-700"
                                        onClick={() =>
                                            setShowDiscardConfirm(false)
                                        }
                                        type="button"
                                    >
                                        Keep editing
                                    </button>
                                    <button
                                        className="cursor-pointer rounded-md bg-red-600 px-3 py-1.5 font-medium text-white text-xs transition-colors hover:bg-red-700"
                                        disabled={isDiscarding}
                                        onClick={() => {
                                            setShowDiscardConfirm(false);
                                            onDiscardReview();
                                        }}
                                        type="button"
                                    >
                                        {isDiscarding
                                            ? "Discarding..."
                                            : "Delete review"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                className="cursor-pointer font-medium text-text-secondary text-xs underline decoration-dotted underline-offset-2 transition-colors hover:text-red-600"
                                onClick={() => setShowDiscardConfirm(true)}
                                type="button"
                            >
                                Discard review
                            </button>
                        )}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
