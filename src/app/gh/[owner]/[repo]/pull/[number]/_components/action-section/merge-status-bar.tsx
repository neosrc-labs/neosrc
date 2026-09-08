"use client";

import { Check, ChevronDown, GitMerge, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import type {
    CheckRun,
    MergeMethod,
    MergeRequirements,
    PullsGetResponseData,
} from "~/server/github";
import type { PullRequestMergeState } from "~/server/github-graphql";
import {
    buildMergeRequirementRows,
    type MergeRequirementRow,
    summarizeMergeRequirements,
} from "./merge-requirement-rows";

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
    isMerging: boolean;
    availableMergeOptions: MergeOptionDef[];
    isMergeBlocked: boolean;
    isMergeStateUnknown: boolean;
    noMergeMethodsAvailable: boolean;
    mergeError: boolean;
    isMergeRequirementsUnavailable: boolean;
    approvalCount?: number;
    changesRequestedCount?: number;
    pendingReviewerCount?: number;
    requirements?: MergeRequirements | null;
    mergeState?: PullRequestMergeState | null;
    checkRuns?: CheckRun[];
    isMergeStatusLoading: boolean;
    isStackMerge?: boolean;
    isBlockedByStack?: string | null;
}

export function MergeStatusBar({
    pullRequest,
    isDraft,
    canMerge,
    canWrite,
    mergeMode,
    onMergeModeChange,
    onMerge,
    isMerging,
    availableMergeOptions,
    isMergeBlocked,
    isMergeStateUnknown,
    noMergeMethodsAvailable,
    mergeError,
    isMergeRequirementsUnavailable,
    approvalCount = 0,
    changesRequestedCount = 0,
    pendingReviewerCount = 0,
    requirements,
    mergeState,
    checkRuns = [],
    isMergeStatusLoading,
    isStackMerge = false,
    isBlockedByStack = null,
}: MergeStatusBarProps) {
    const effectiveMergeMode = availableMergeOptions.some(
        (o) => o.value === mergeMode,
    )
        ? mergeMode
        : (availableMergeOptions[0]?.value ?? "merge");

    if (pullRequest.mergeable_state === "dirty") {
        return <CannotMerge variant="danger">Conflicts</CannotMerge>;
    }

    if (isDraft && canWrite) {
        return null;
    }

    if (isMergeStatusLoading) {
        return (
            <CannotMerge noWrapper>
                <div className="h-3 w-20 animate-pulse rounded bg-zinc-300 dark:bg-zinc-600" />
            </CannotMerge>
        );
    }
    if (isMergeRequirementsUnavailable) {
        return <CannotMerge>Couldn&apos;t determine mergeability</CannotMerge>;
    }
    if (isBlockedByStack) {
        const isConflict = isBlockedByStack === "conflicts";
        return (
            <CannotMerge variant={isConflict ? "danger" : "normal"}>
                {isConflict
                    ? "Stack conflicts"
                    : "Earlier pull requests in the stack must be merged first"}
            </CannotMerge>
        );
    }
    // A strict-checks repo whose branch is behind must not render a green
    // merge button: GitHub rejects the merge.
    const isBehindAndStrict =
        requirements?.requiresUpToDateBranch === true &&
        mergeState?.mergeStateStatus === "BEHIND";
    if (isMergeBlocked || isBehindAndStrict) {
        return (
            <BlockingReasons
                rows={buildMergeRequirementRows({
                    requirements,
                    mergeState,
                    checkRuns,
                    approvalCount,
                    changesRequestedCount,
                })}
                pendingReviewerCount={pendingReviewerCount}
            />
        );
    }

    if (isMergeStateUnknown) {
        return <CannotMerge>Checking mergeability...</CannotMerge>;
    }

    if (noMergeMethodsAvailable) {
        return (
            <CannotMerge>
                Merging is not allowed for this repository
            </CannotMerge>
        );
    }

    if (!canMerge) {
        return (
            <CannotMerge>You don&apos;t have permission to merge</CannotMerge>
        );
    }

    const buttonText = isMerging
        ? "Merging..."
        : isStackMerge
          ? effectiveMergeMode === "squash"
              ? "Squash and merge stack"
              : effectiveMergeMode === "rebase"
                ? "Rebase and merge stack"
                : "Merge stack"
          : effectiveMergeMode === "squash"
            ? "Squash and merge"
            : effectiveMergeMode === "rebase"
              ? "Rebase and merge"
              : "Merge pull request";
    return (
        <div className="flex items-stretch">
            {mergeError && (
                <span className="mr-2 text-red-600 text-xs">
                    Failed to merge. Please try again.
                </span>
            )}
            <button
                className="flex cursor-pointer items-center gap-1.5 text-nowrap rounded-l-md bg-[#2da44e] px-1.5 py-2 font-medium text-white text-xs transition-colors hover:bg-[#218838] disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
                disabled={isMerging}
                onClick={onMerge}
                title={buttonText}
                type="button"
            >
                <GitMerge size={14} />
                {buttonText}
            </button>
            <MergeModeDropdown
                effectiveMergeMode={effectiveMergeMode}
                availableMergeOptions={availableMergeOptions}
                onMergeModeChange={onMergeModeChange}
            >
                <button
                    suppressHydrationWarning
                    className="flex cursor-pointer items-center rounded-r-md border-[#1a7f37] border-l bg-[#2da44e] px-2.5 text-white transition-colors hover:bg-[#218838] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isMerging}
                    type="button"
                    title="Merge options"
                >
                    <ChevronDown className="h-4 w-4" />
                </button>
            </MergeModeDropdown>
        </div>
    );
}

function BlockingReasons({
    rows,
    pendingReviewerCount,
}: {
    rows: MergeRequirementRow[];
    pendingReviewerCount: number;
}) {
    const parts = summarizeMergeRequirements(rows, pendingReviewerCount);

    return (
        <MergeRequirementsPopover rows={rows}>
            <button type="button" className="cursor-pointer">
                <CannotMerge>
                    {parts.length === 0
                        ? "Merging blocked"
                        : parts.join(" \u00b7 ")}
                </CannotMerge>
            </button>
        </MergeRequirementsPopover>
    );
}

function MergeRequirementsPopover({
    rows,
    children,
}: {
    rows: MergeRequirementRow[];
    children: ReactNode;
}) {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent
                align="start"
                side="bottom"
                sideOffset={8}
                className="w-80 bg-surface p-0"
            >
                <div className="border-border-subtle border-b px-3 py-2">
                    <div className="font-medium text-xs">
                        Merge requirements
                    </div>
                </div>
                <div className="max-h-80 space-y-1.5 overflow-y-auto p-3">
                    {rows.length === 0 ? (
                        <div className="px-2 py-1.5 text-text-tertiary text-xs">
                            GitHub is blocking this merge but did not report a
                            reason.
                        </div>
                    ) : (
                        rows.map((row) => (
                            <MergeRequirementRowItem key={row.key} row={row} />
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

function MergeRequirementRowItem({ row }: { row: MergeRequirementRow }) {
    const content = (
        <>
            {row.status === "failing" ? (
                <X className="size-3.5 shrink-0 text-red-600" />
            ) : row.status === "pending" ? (
                <span className="check-pending-dot size-2.5 shrink-0 rounded-full" />
            ) : (
                <Check className="size-3.5 shrink-0 text-green-600" />
            )}
            <span className="truncate font-medium text-text-primary">
                {row.label}
            </span>
        </>
    );
    const className =
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-surface-tertiary";

    return row.url ? (
        <a
            href={row.url}
            target="_blank"
            rel="noreferrer"
            className={className}
        >
            {content}
        </a>
    ) : (
        <div className={className}>{content}</div>
    );
}

export function MergeModeDropdown({
    effectiveMergeMode,
    availableMergeOptions,
    onMergeModeChange,
    children,
}: {
    effectiveMergeMode: MergeMethod;
    availableMergeOptions: Array<{
        value: MergeMethod;
        label: string;
        description: string;
    }>;
    onMergeModeChange: (mode: MergeMethod) => void;
    children: ReactNode;
}) {
    const [isMergeOptionsOpen, setIsMergeOptionsOpen] = useState(false);
    return (
        <Popover open={isMergeOptionsOpen} onOpenChange={setIsMergeOptionsOpen}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent
                align="end"
                avoidCollisions={false}
                className="w-72 bg-surface p-2"
                side="bottom"
                sideOffset={8}
            >
                <div className="space-y-1">
                    {availableMergeOptions.map((option) => (
                        <button
                            key={option.value}
                            className={`flex w-full cursor-pointer items-start gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
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
    );
}

function CannotMerge({
    variant = "normal",
    noWrapper = false,
    children,
}: {
    variant?: "normal" | "danger";
    noWrapper?: boolean;
    children: ReactNode | string;
}) {
    return (
        <div className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-surface-secondary px-1.5 py-2 sm:px-3 dark:border-zinc-600">
            <GitMerge
                size={14}
                className={
                    variant === "normal"
                        ? "text-text-muted"
                        : "text-state-closed"
                }
            />

            {noWrapper ? (
                children
            ) : (
                <span className="font-medium text-text-secondary text-xs">
                    {children}
                </span>
            )}
        </div>
    );
}
