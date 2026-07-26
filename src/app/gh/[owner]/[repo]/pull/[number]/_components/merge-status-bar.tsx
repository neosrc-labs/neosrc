"use client";

import { ChevronDown, GitMerge } from "lucide-react";
import { useState } from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import type { MergeMethod, PullsGetResponseData } from "~/server/github";

interface MergeOptionDef {
    value: MergeMethod;
    label: string;
    description: string;
    allowed: boolean;
}

interface MergeStatusBarProps {
    pullRequest: PullsGetResponseData;
    isDraft: boolean;
    canMerge: boolean;
    canWrite: boolean;
    mergeMode: MergeMethod;
    onMergeModeChange: (mode: MergeMethod) => void;
    onMerge: () => void;
    onMarkReady: () => void;
    isMarkingReady: boolean;
    isMerging: boolean;
    availableMergeOptions: MergeOptionDef[];
    isMergeBlocked: boolean;
    isMergeStateUnknown: boolean;
    noMergeMethodsAvailable: boolean;
    mergeError: boolean;
}

export function MergeStatusBar({
    pullRequest,
    isDraft,
    canMerge,
    canWrite,
    mergeMode,
    onMergeModeChange,
    onMerge,
    onMarkReady,
    isMarkingReady,
    isMerging,
    availableMergeOptions,
    isMergeBlocked,
    isMergeStateUnknown,
    noMergeMethodsAvailable,
    mergeError,
}: MergeStatusBarProps) {
    const [isMergeOptionsOpen, setIsMergeOptionsOpen] = useState(false);
    const effectiveMergeMode = availableMergeOptions.some(
        (o) => o.value === mergeMode,
    )
        ? mergeMode
        : (availableMergeOptions[0]?.value ?? "merge");

    if (pullRequest.mergeable_state === "dirty") {
        return (
            <div className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-surface-secondary px-3 py-2 dark:border-zinc-600">
                <GitMerge size={14} className="text-red-500" />
                <span className="font-medium text-sm text-text-secondary">
                    Conflicts
                </span>
            </div>
        );
    }

    if (isDraft && canWrite) {
        return (
            <button
                className="cursor-pointer rounded-md bg-gray-200 px-3 py-2 font-medium text-gray-800 text-sm transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isMarkingReady}
                onClick={onMarkReady}
                type="button"
            >
                {isMarkingReady ? "Marking..." : "Mark as ready for review"}
            </button>
        );
    }

    if (isMergeBlocked) {
        return (
            <div className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-surface-secondary px-3 py-2 dark:border-zinc-600">
                <GitMerge size={14} className="text-text-muted" />
                <span className="font-medium text-sm text-text-muted">
                    Merging is blocked
                </span>
            </div>
        );
    }

    if (isMergeStateUnknown) {
        return (
            <div className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-surface-secondary px-3 py-2 dark:border-zinc-600">
                <GitMerge size={14} className="text-text-muted" />
                <span className="font-medium text-sm text-text-muted">
                    Checking mergeability...
                </span>
            </div>
        );
    }

    if (noMergeMethodsAvailable) {
        return (
            <div className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-surface-secondary px-3 py-2 dark:border-zinc-600">
                <GitMerge size={14} className="text-text-muted" />
                <span className="font-medium text-sm text-text-muted">
                    Merging is not allowed for this repository
                </span>
            </div>
        );
    }

    if (!canMerge) {
        return (
            <div className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-surface-secondary px-3 py-2 dark:border-zinc-600">
                <GitMerge size={14} className="text-text-muted" />
                <span className="font-medium text-sm text-text-muted">
                    You don&apos;t have permission to merge
                </span>
            </div>
        );
    }

    return (
        <div className="flex items-center">
            {mergeError && (
                <span className="mr-2 text-red-600 text-xs">
                    Failed to merge. Please try again.
                </span>
            )}
            <button
                className="flex cursor-pointer items-center gap-1.5 rounded-l-md bg-[#2da44e] px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-[#218838] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isMerging}
                onClick={onMerge}
                type="button"
            >
                <GitMerge size={14} />
                {isMerging
                    ? "Merging..."
                    : effectiveMergeMode === "squash"
                      ? "Squash and merge"
                      : effectiveMergeMode === "rebase"
                        ? "Rebase and merge"
                        : "Merge pull request"}
            </button>
            <Popover
                open={isMergeOptionsOpen}
                onOpenChange={setIsMergeOptionsOpen}
            >
                <PopoverTrigger asChild>
                    <button
                        suppressHydrationWarning
                        className="cursor-pointer rounded-r-md border-[#1a7f37] border-l bg-[#2da44e] px-2 py-2 text-white transition-colors hover:bg-[#218838] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isMerging}
                        type="button"
                        title="Merge options"
                    >
                        <ChevronDown className="h-4 w-4" />
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    align="end"
                    className="w-72 bg-surface p-2"
                    side="left"
                    sideOffset={8}
                >
                    <div className="space-y-1">
                        {availableMergeOptions.map((option) => (
                            <button
                                key={option.value}
                                className={`flex w-full items-start gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                    effectiveMergeMode === option.value
                                        ? "bg-surface-tertiary"
                                        : "hover:bg-surface-secondary"
                                }`}
                                onClick={() => {
                                    onMergeModeChange(option.value);
                                    setIsMergeOptionsOpen(false);
                                }}
                                type="button"
                            >
                                <span
                                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                                        effectiveMergeMode === option.value
                                            ? "border-[#2da44e]"
                                            : "border-gray-300 dark:border-zinc-600"
                                    }`}
                                >
                                    {effectiveMergeMode === option.value && (
                                        <span className="flex h-2 w-2 rounded-full bg-[#2da44e]" />
                                    )}
                                </span>
                                <div>
                                    <div
                                        className={
                                            effectiveMergeMode === option.value
                                                ? "font-medium text-text-primary"
                                                : "text-text-label"
                                        }
                                    >
                                        {option.label}
                                    </div>
                                    <div className="text-text-tertiary text-xs">
                                        {option.description}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
