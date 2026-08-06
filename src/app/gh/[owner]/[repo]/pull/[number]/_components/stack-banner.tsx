"use client";

import { Layers, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import type { StackSuggestion } from "~/server/github";

interface StackBannerProps {
    suggestion: StackSuggestion;
    onDismiss: () => void;
    onCreateStack: () => void;
}

export function StackBanner({
    suggestion,
    onDismiss,
    onCreateStack,
}: StackBannerProps) {
    const count = suggestion.pullRequests.length;
    const [bottom] = suggestion.pullRequests;
    const label =
        count === 2
            ? `Stack this pull request on #${bottom?.number}?`
            : `Stack these ${count} pull requests?`;

    return (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 dark:border-blue-500/20 dark:bg-blue-500/10">
            <div className="flex min-w-0 items-center gap-2.5">
                <Layers className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <p className="truncate font-medium text-sm text-text-primary">
                    {label}
                </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
                <Button
                    size="sm"
                    className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                    onClick={onCreateStack}
                >
                    Create stack
                </Button>
                <button
                    type="button"
                    aria-label="Dismiss stack suggestion"
                    className="flex size-6 cursor-pointer items-center justify-center rounded text-text-secondary transition-colors hover:text-text"
                    onClick={onDismiss}
                >
                    <X className="size-4" />
                </button>
            </div>
        </div>
    );
}
