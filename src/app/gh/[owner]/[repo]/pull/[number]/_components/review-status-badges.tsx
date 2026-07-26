"use client";

import { Check, CircleX, Clock } from "lucide-react";

interface ReviewStatusBadgesProps {
    approvalCount: number;
    changesRequestedCount: number;
    pendingReviewerCount: number;
    requiredApprovalCount: number;
}

export function ReviewStatusBadges({
    approvalCount,
    changesRequestedCount,
    pendingReviewerCount,
    requiredApprovalCount,
}: ReviewStatusBadgesProps) {
    if (
        requiredApprovalCount === 0 &&
        approvalCount === 0 &&
        changesRequestedCount === 0 &&
        pendingReviewerCount === 0
    ) {
        return null;
    }

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {requiredApprovalCount > 0 && (
                <div
                    className={`flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs ${
                        approvalCount >= requiredApprovalCount
                            ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-400"
                            : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-400"
                    }`}
                >
                    <Check size={12} />
                    <span className="font-medium">
                        {approvalCount} of {requiredApprovalCount} approvals
                    </span>
                </div>
            )}
            {changesRequestedCount > 0 && (
                <div className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-red-700 text-xs dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
                    <CircleX size={12} />
                    <span className="font-medium">
                        {changesRequestedCount} change
                        {changesRequestedCount !== 1 ? "s" : ""} requested
                    </span>
                </div>
            )}
            {pendingReviewerCount > 0 && (
                <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-gray-600 text-xs dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
                    <Clock size={12} />
                    <span className="font-medium">
                        {pendingReviewerCount} pending
                    </span>
                </div>
            )}
        </div>
    );
}
