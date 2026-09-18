"use client";

import type { BranchTab } from "~/server/api/routers/branches/types";
import { BRANCH_PAGE_SIZE, OVERVIEW_PREVIEW_SIZE } from "./branch-list-config";
import { BranchSection } from "./branch-section";
import { BranchTableShell } from "./branch-table-shell";

/**
 * Row geometry mirrors a loaded branch row exactly: same 40px row, same
 * header, same section headings and the same count of rows as the tab it
 * stands in for, so nothing moves when the data arrives.
 */
function SkeletonRows({ count }: { count: number }) {
    return Array.from({ length: count }, (_, i) => `row-${i}`).map((key) => (
        <tr key={key} className="h-10 border-border-subtle border-b">
            {COLUMNS.map((column) => (
                <td key={column} className="px-4 py-2">
                    <div
                        className={`animate-pulse rounded bg-surface-selected ${BAR_CLASS[column]}`}
                    />
                </td>
            ))}
        </tr>
    ));
}

const COLUMNS = ["branch", "updated", "checks", "pull", "actions"] as const;

// The action bar is 24px because the loaded action cell holds two 24px
// buttons, which is what sets a loaded row's content height.
const BAR_CLASS: Record<(typeof COLUMNS)[number], string> = {
    branch: "h-4 w-48",
    updated: "h-4 w-28",
    checks: "h-4 w-16",
    pull: "h-4 w-12",
    actions: "size-6",
};

/** Pagination control placeholder: the nav strip is 57px loaded. */
function PaginationSkeleton() {
    return (
        <div className="flex items-center justify-center gap-2 border-border-subtle border-t px-4 py-3">
            <div className="h-8 w-24 animate-pulse rounded bg-surface-selected" />
            <div className="h-8 w-32 animate-pulse rounded bg-surface-selected" />
            <div className="h-8 w-24 animate-pulse rounded bg-surface-selected" />
        </div>
    );
}

export function BranchTableSkeleton({ tab }: { tab: BranchTab }) {
    if (tab === "overview") {
        return (
            <>
                <BranchSection title="Default">
                    <BranchTableShell>
                        <SkeletonRows count={1} />
                    </BranchTableShell>
                </BranchSection>
                <BranchSection title="Active branches">
                    <BranchTableShell>
                        <SkeletonRows count={OVERVIEW_PREVIEW_SIZE} />
                    </BranchTableShell>
                    <div className="px-4 py-3">
                        <div className="h-5 w-32 animate-pulse rounded bg-surface-selected" />
                    </div>
                </BranchSection>
            </>
        );
    }

    return (
        <>
            <BranchTableShell>
                <SkeletonRows count={BRANCH_PAGE_SIZE} />
            </BranchTableShell>
            <PaginationSkeleton />
        </>
    );
}
