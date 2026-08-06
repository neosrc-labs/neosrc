"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "~/lib/utils";

interface CommitsPaginationFooterProps {
    page: number;
    totalPages: number;
    hasPrevious: boolean;
    hasNext: boolean;
    onPrevious: () => void;
    onNext: () => void;
    showPageNumbers: boolean;
}

const btnBase =
    "inline-flex items-center justify-center gap-1 rounded-md px-3 py-1.5 font-medium text-sm transition-colors";
const btnActive =
    "cursor-pointer text-text-label hover:bg-surface-tertiary hover:text-text-primary dark:hover:text-zinc-100";
const btnDisabled = "cursor-not-allowed text-text-muted opacity-50";

export function CommitsPaginationFooter({
    page,
    totalPages,
    hasPrevious,
    hasNext,
    onPrevious,
    onNext,
    showPageNumbers,
}: CommitsPaginationFooterProps) {
    if (totalPages <= 1) return null;

    return (
        <div className="mt-6 flex items-center justify-center gap-4">
            <button
                type="button"
                onClick={onPrevious}
                disabled={!hasPrevious}
                className={cn(btnBase, !hasPrevious ? btnDisabled : btnActive)}
            >
                <ChevronLeft className="size-4" />
                Previous
            </button>
            {showPageNumbers && (
                <span className="text-sm text-text-secondary">
                    Page {page} of {totalPages}
                </span>
            )}
            <button
                type="button"
                onClick={onNext}
                disabled={!hasNext}
                className={cn(btnBase, !hasNext ? btnDisabled : btnActive)}
            >
                Next
                <ChevronRight className="size-4" />
            </button>
        </div>
    );
}
