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
                    className={`flex items-center gap-1.5 rounded-md border px-1.5 py-2 font-medium text-sm sm:px-3 ${
                        approvalCount >= requiredApprovalCount
                            ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-400"
                            : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-400"
                    }`}
                >
                    <Check size={14} />
                    {approvalCount} of {requiredApprovalCount} approvals
                </div>
            )}
            {changesRequestedCount > 0 && (
                <div className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-1.5 py-2 font-medium text-red-700 text-sm sm:px-3 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
                    <CircleX size={14} />
                    {changesRequestedCount} change
                    {changesRequestedCount !== 1 ? "s" : ""} requested
                </div>
            )}
            {pendingReviewerCount > 0 && (
                <div className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-2 font-medium text-gray-600 text-sm sm:px-3 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
                    <Clock size={14} />
                    {pendingReviewerCount} pending
                </div>
            )}
        </div>
    );
}
