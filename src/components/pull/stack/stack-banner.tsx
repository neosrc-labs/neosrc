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
        <div className="flex items-center justify-between gap-3 rounded-lg border border-info-border bg-info-surface px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
                <Layers className="size-4 shrink-0 text-info-emphasis" />
                <p className="truncate font-medium text-sm text-text-primary">
                    {label}
                </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
                <Button size="sm" onClick={onCreateStack}>
                    Create stack
                </Button>
                <button
                    type="button"
                    aria-label="Dismiss stack suggestion"
                    className="flex size-6 cursor-pointer items-center justify-center rounded text-text-secondary transition-colors hover:text-text-primary"
                    onClick={onDismiss}
                >
                    <X className="size-4" />
                </button>
            </div>
        </div>
    );
}
