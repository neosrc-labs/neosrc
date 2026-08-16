"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

interface ResolvedThreadBannerProps {
    onShow: () => void;
    /** Login of the user who resolved the thread. */
    resolver: string;
}

export function ResolvedThreadBanner({
    onShow,
    resolver,
}: ResolvedThreadBannerProps) {
    return (
        <div className="my-2 flex max-w-[800px] items-center justify-between gap-2 rounded-lg border border-border bg-surface py-2 pr-2 pl-4">
            <span className="min-w-0 truncate text-text-tertiary text-xs">
                {resolver} marked this conversation as resolved
            </span>
            <button
                type="button"
                onClick={onShow}
                className="flex shrink-0 cursor-pointer items-center gap-1 rounded px-2 py-1 text-text-muted text-xs transition-colors hover:bg-surface-tertiary hover:text-text-secondary dark:hover:text-zinc-300"
            >
                <ChevronDown size={14} />
                Show thread
            </button>
        </div>
    );
}

interface ResolveButtonProps {
    onClick: () => void;
    isPending: boolean;
    isUnresolve?: boolean;
}

/** Collapse an expanded resolved thread back to its resolution banner. */
export function CollapseButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex shrink-0 cursor-pointer items-center gap-1 rounded px-2 py-1 text-text-muted text-xs transition-colors hover:bg-surface-tertiary hover:text-text-secondary dark:hover:text-zinc-300"
        >
            <ChevronUp size={14} />
            Collapse
        </button>
    );
}

export function ResolveButton({
    onClick,
    isPending,
    isUnresolve,
}: ResolveButtonProps) {
    return (
        <button
            type="button"
            disabled={isPending}
            onClick={onClick}
            className="flex shrink-0 cursor-pointer items-center gap-1 rounded px-2 py-1 text-text-muted text-xs transition-colors hover:bg-surface-tertiary hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-zinc-300"
        >
            {isUnresolve ? "Unresolve" : "Resolve"}
        </button>
    );
}
