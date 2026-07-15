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
            className="flex w-full cursor-pointer items-center justify-center gap-1 border-gray-200 border-b bg-gray-50 px-3 py-2 text-text-tertiary text-xs transition-colors hover:bg-gray-100 hover:text-text-label dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
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
            className="flex shrink-0 cursor-pointer items-center gap-1 rounded px-2 py-1 text-text-muted text-xs transition-colors hover:bg-gray-100 hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
            {isUnresolve ? "Unresolve" : "Resolve"}
        </button>
    );
}
