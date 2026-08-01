"use client";

import { Check, ChevronDown, GitMerge, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "~/components/ui/hover-card";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import type {
    CheckRun,
    MergeMethod,
    PullsGetResponseData,
} from "~/server/github";

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
    approvalCount?: number;
    changesRequestedCount?: number;
    pendingReviewerCount?: number;
    requiredApprovalCount?: number;
    requiredChecks?: string[];
    checkRuns?: CheckRun[];
    isMergeStatusLoading: boolean;
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
    approvalCount = 0,
    changesRequestedCount = 0,
    pendingReviewerCount = 0,
    requiredApprovalCount = 0,
    requiredChecks = [],
    checkRuns = [],
    isMergeStatusLoading,
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

    if (isMergeBlocked) {
        if (isMergeStatusLoading) {
            return (
                <CannotMerge noWrapper>
                    <div className="h-3 w-20 animate-pulse rounded bg-zinc-300 dark:bg-zinc-600" />
                </CannotMerge>
            );
        }
        return (
            <BlockingReasons
                requiredChecks={requiredChecks}
                checkRuns={checkRuns}
                approvalCount={approvalCount}
                requiredApprovalCount={requiredApprovalCount}
                changesRequestedCount={changesRequestedCount}
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
    requiredChecks,
    checkRuns,
    approvalCount,
    requiredApprovalCount,
    changesRequestedCount,
    pendingReviewerCount,
}: {
    requiredChecks: string[];
    checkRuns: CheckRun[];
    approvalCount: number;
    requiredApprovalCount: number;
    changesRequestedCount: number;
    pendingReviewerCount: number;
}) {
    const checkStatuses = requiredChecks.map((name) => {
        const normalized = name.trim().toLowerCase();
        const match = checkRuns.find(
            (c) => c.name.trim().toLowerCase() === normalized,
        );
        const failed =
            match?.conclusion === "failure" ||
            match?.conclusion === "timed_out" ||
            match?.conclusion === "cancelled";
        return { name, failed, pending: !match } satisfies CheckStatus;
    });

    const failingChecks = checkStatuses.filter((c) => c.failed);
    const pendingChecks = checkStatuses.filter((c) => c.pending);

    const parts: React.ReactNode[] = [];
    if (requiredApprovalCount > 0) {
        parts.push(`${approvalCount}/${requiredApprovalCount} approvals`);
    }
    if (changesRequestedCount > 0) {
        parts.push(
            `${changesRequestedCount} change${changesRequestedCount !== 1 ? "s" : ""} requested`,
        );
    }
    if (pendingReviewerCount > 0) {
        parts.push(`${pendingReviewerCount} pending`);
    }
    if (failingChecks.length > 0) {
        parts.push(
            <CheckStatusHoverCard
                checkStatuses={checkStatuses}
                checkRuns={checkRuns}
            >
                <button type="button">
                    {failingChecks.length} check
                    {failingChecks.length !== 1 ? "s" : ""} failing
                </button>
            </CheckStatusHoverCard>,
        );
    }
    if (pendingChecks.length > 0) {
        parts.push(
            `${pendingChecks.length} check${pendingChecks.length !== 1 ? "s" : ""} pending`,
        );
    }

    return (
        <CannotMerge>
            {parts.length === 0
                ? "Merging blocked"
                : parts.reduce<React.ReactNode[]>((acc, part, i) => {
                      if (i > 0) {
                          acc.push(" \u00b7 ");
                      }
                      acc.push(part);
                      return acc;
                  }, [])}
        </CannotMerge>
    );
}

type CheckStatus = {
    name: string;
    failed: boolean;
    pending: boolean;
};

function CheckStatusHoverCard({
    checkStatuses,
    checkRuns,
    children,
}: {
    checkStatuses: CheckStatus[];
    checkRuns: CheckRun[];
    children: ReactNode;
}) {
    return (
        <HoverCard key="failing" openDelay={200}>
            <HoverCardTrigger asChild>{children}</HoverCardTrigger>
            <HoverCardContent
                align="start"
                side="bottom"
                className="w-72 bg-surface p-0"
            >
                <div className="border-border-subtle border-b px-3 py-2">
                    <div className="font-medium text-xs">
                        Some required checks were not successful
                    </div>
                </div>
                <div className="max-h-80 space-y-1.5 overflow-y-auto p-3">
                    {checkStatuses.map((check) => {
                        const match = checkRuns.find(
                            (c) =>
                                c.name.trim().toLowerCase() ===
                                check.name.trim().toLowerCase(),
                        );
                        return (
                            <a
                                key={check.name}
                                href={match?.html_url ?? "#"}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-surface-tertiary"
                            >
                                {check.failed ? (
                                    <X className="size-3.5 shrink-0 text-red-600" />
                                ) : check.pending ? (
                                    <span className="check-pending-dot size-2.5 shrink-0 rounded-full" />
                                ) : (
                                    <Check className="size-3.5 shrink-0 text-green-600" />
                                )}
                                <span className="truncate font-medium text-text-primary">
                                    {check.name}
                                </span>
                            </a>
                        );
                    })}
                </div>
            </HoverCardContent>
        </HoverCard>
    );
}

function MergeModeDropdown({
    effectiveMergeMode,
    availableMergeOptions,
    onMergeModeChange,
    children,
}: {
    effectiveMergeMode: MergeMethod;
    availableMergeOptions: MergeOptionDef[];
    onMergeModeChange: (mode: MergeMethod) => void;
    children: ReactNode;
}) {
    const [isMergeOptionsOpen, setIsMergeOptionsOpen] = useState(false);
    return (
        <Popover open={isMergeOptionsOpen} onOpenChange={setIsMergeOptionsOpen}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
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
                    variant === "normal" ? "text-text-muted" : "text-red-500"
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
