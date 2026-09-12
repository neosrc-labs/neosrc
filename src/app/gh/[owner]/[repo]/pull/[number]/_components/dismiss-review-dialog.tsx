"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import { TIMELINE_PAGE_SIZE } from "~/lib/timeline-constants";
import { api } from "~/trpc/react";

/**
 * Dismisses a submitted review. GitHub requires a message, turns the review
 * state to DISMISSED, and records the message as a ReviewDismissedEvent.
 */
export function DismissReviewDialog({
    owner,
    repo,
    number,
    reviewId,
    reviewerLogin,
    onClose,
}: {
    owner: string;
    repo: string;
    number: number;
    reviewId: number;
    reviewerLogin: string;
    onClose: () => void;
}) {
    const utils = api.useUtils();
    const [message, setMessage] = useState("");

    const dismissMutation = api.reviews.dismiss.useMutation({
        onSuccess: () => {
            onClose();
        },
        onSettled: () => {
            utils.timeline.list.invalidate({
                owner,
                repo,
                number,
                limit: TIMELINE_PAGE_SIZE,
            });
            utils.pulls.listReviews.invalidate({ owner, repo, number });
            utils.pulls.getMergeState.invalidate({ owner, repo, number });
        },
    });

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Dismiss review</DialogTitle>
                    <DialogDescription>
                        Dismiss the review by {reviewerLogin}.
                    </DialogDescription>
                </DialogHeader>
                <textarea
                    aria-label="Reason for dismissing this review"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Reason for dismissing this review"
                    rows={4}
                    className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-ring dark:placeholder-zinc-500"
                />
                {dismissMutation.isError && (
                    <p className="text-destructive text-sm">
                        Dismissing this review failed. You may not have
                        permission to dismiss reviews on this branch.
                    </p>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        disabled={
                            message.trim().length === 0 ||
                            dismissMutation.isPending
                        }
                        onClick={() =>
                            dismissMutation.mutate({
                                owner,
                                repo,
                                number,
                                reviewId,
                                message: message.trim(),
                            })
                        }
                    >
                        Dismiss review
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
