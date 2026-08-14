"use client";

import { ChevronDown } from "lucide-react";

export const formatReason = (reason: string) =>
    reason
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

interface MinimizedCommentBannerProps {
    /** "comment" for issue comments, "review" for pull request reviews. */
    subject: "comment" | "review";
    authorLogin: string | null | undefined;
    minimizedReason: string | null | undefined;
    onShow: () => void;
}

export function MinimizedCommentBanner({
    subject,
    authorLogin,
    minimizedReason,
    onShow,
}: MinimizedCommentBannerProps) {
    return (
        <div className="/50 rounded-lg border border-border bg-surface-secondary p-3">
            <div className="flex items-center justify-between">
                <p className="text-sm text-text-tertiary">
                    A {subject} by{" "}
                    <span className="font-medium text-text-label">
                        {authorLogin ?? "unknown"}
                    </span>{" "}
                    was minimized as{" "}
                    <span className="font-medium text-text-label">
                        {minimizedReason
                            ? formatReason(minimizedReason)
                            : "outdated"}
                    </span>
                </p>
                <button
                    type="button"
                    onClick={onShow}
                    className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-text-tertiary text-xs transition-colors hover:bg-surface-selected hover:text-text-label dark:hover:text-zinc-300"
                >
                    <ChevronDown size={14} />
                    Show {subject}
                </button>
            </div>
        </div>
    );
}
