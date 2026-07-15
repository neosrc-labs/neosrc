"use client";

import { ChevronDown } from "lucide-react";

interface ResolvedThreadBannerProps {
    onShow: () => void;
}

export function ResolvedThreadBanner({ onShow }: ResolvedThreadBannerProps) {
    return (
        <button
            type="button"
            onClick={onShow}
            className="flex w-full cursor-pointer items-center justify-center gap-1 border-border border-b bg-surface-secondary px-3 py-2 text-text-tertiary text-xs transition-colors hover:bg-surface-tertiary hover:text-text-label dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
        >
            <ChevronDown size={14} />
            Show thread
        </button>
    );
}

interface ResolveButtonProps {
    onClick: () => void;
    isPending: boolean;
    isUnresolve?: boolean;
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
