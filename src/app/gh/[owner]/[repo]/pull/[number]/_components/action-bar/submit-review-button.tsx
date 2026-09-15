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

type ReviewAction = "APPROVE" | "COMMENT" | "REQUEST_CHANGES";

const REVIEW_ACTIONS: Array<{
    value: ReviewAction;
    title: string;
    description: string;
}> = [
    {
        value: "COMMENT",
        title: "Comment",
        description:
            "Submit general feedback without explicitly approving or requesting changes.",
    },
    {
        value: "APPROVE",
        title: "Approve",
        description: "Submit feedback and approve merging these changes.",
    },
    {
        value: "REQUEST_CHANGES",
        title: "Request changes",
        description: "Submit feedback that must be addressed before merging.",
    },
];

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
    const [action, setAction] = useState<ReviewAction>("COMMENT");
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

    const isSubmitting =
        approveMutation.isPending || submitReviewMutation.isPending;
    const optionDisabled = (value: ReviewAction) =>
        isAuthor && value !== "COMMENT";
    const submitDisabled =
        isSubmitting ||
        (action === "COMMENT" && !body.trim() && pendingCommentsCount === 0) ||
        optionDisabled(action);

    const handleSubmit = useCallback(() => {
        const cleanup = () => {
            setIsPopoverOpen(false);
            setBody("");
            setAction("COMMENT");
            setShowDiscardConfirm(false);
            clearReviewBody();
        };

        const payload = {
            owner,
            repo,
            number,
            event: action,
            body: body || undefined,
        };

        if (pendingReview) {
            submitReviewMutation.mutate(
                { ...payload, reviewId: pendingReview.reviewId },
                { onSuccess: cleanup },
            );
        } else {
            approveMutation.mutate(payload, { onSuccess: cleanup });
        }
    }, [
        owner,
        repo,
        number,
        action,
        pendingReview,
        body,
        approveMutation,
        submitReviewMutation,
        clearReviewBody,
    ]);

    return (
        <Popover
            open={isPopoverOpen}
            onOpenChange={(open) => {
                setIsPopoverOpen(open);
                if (!open) {
                    setAction("COMMENT");
                    setShowDiscardConfirm(false);
                }
            }}
        >
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
                className="w-[42rem] max-w-[calc(100vw-2rem)] bg-surface p-4"
                side="top"
                sideOffset={8}
            >
                <MarkdownEditor
                    autoFocus
                    disabled={isSubmitting}
                    minHeight="150px"
                    onChange={setBody}
                    owner={owner}
                    placeholder="Leave a review comment"
                    repo={repo}
                    value={body}
                />

                <fieldset className="mt-3">
                    <legend className="sr-only">Review action</legend>
                    <div className="flex flex-col gap-1.5">
                        {REVIEW_ACTIONS.map((option) => {
                            const disabled = optionDisabled(option.value);
                            const selected = action === option.value;
                            return (
                                <label
                                    className={`flex items-start gap-2.5 rounded-md border px-3 py-2 transition-colors ${
                                        selected
                                            ? "border-[#0969da] bg-[#0969da]/5"
                                            : "border-gray-300 dark:border-zinc-600"
                                    } ${
                                        disabled
                                            ? "cursor-not-allowed opacity-50"
                                            : "cursor-pointer hover:bg-surface-secondary"
                                    }`}
                                    key={option.value}
                                    title={
                                        disabled
                                            ? "You cannot approve or request changes on your own pull request."
                                            : undefined
                                    }
                                >
                                    <input
                                        checked={selected}
                                        className="mt-0.5 size-3.5 shrink-0 accent-[#0969da]"
                                        disabled={disabled}
                                        name="review-action"
                                        onChange={() => setAction(option.value)}
                                        type="radio"
                                        value={option.value}
                                    />
                                    <span className="flex flex-col gap-0.5">
                                        <span className="font-medium text-sm text-text-primary leading-none">
                                            {option.title}
                                        </span>
                                        <span className="text-text-secondary text-xs">
                                            {option.description}
                                        </span>
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </fieldset>

                <div className="mt-3 flex justify-end">
                    <button
                        className="inline-flex cursor-pointer items-center justify-center rounded-md bg-[#2da44e] px-4 py-1.5 font-medium text-sm text-white transition-colors hover:bg-[#218838] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={submitDisabled}
                        onClick={handleSubmit}
                        type="button"
                    >
                        {isSubmitting ? "Submitting..." : "Submit review"}
                    </button>
                </div>

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
