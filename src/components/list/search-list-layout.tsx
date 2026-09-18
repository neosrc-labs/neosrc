"use client";

import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Pagination } from "~/components/ui/pagination";
import type { SearchListResult } from "./use-search-list";

export function SearchListLayout({
    searchBar,
    toolbar,
    showLoading,
    refreshStatus,
    isEmpty,
    skeleton,
    emptyState,
    rows,
    currentPage,
    totalPages,
    onPageChange,
}: {
    searchBar: ReactNode;
    toolbar: ReactNode;
    showLoading: boolean;
    refreshStatus?: SearchListResult<unknown>["refreshStatus"];
    isEmpty: boolean;
    skeleton: ReactNode;
    emptyState: ReactNode;
    rows: ReactNode;
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}) {
    return (
        <div>
            {searchBar}
            {toolbar}

            <div className="flex items-center gap-3 border-border-subtle border-b px-4 py-1.5 text-text-muted text-xs">
                <div className="size-4 shrink-0" />
                <div
                    role={refreshStatus ? "status" : undefined}
                    aria-live="polite"
                    aria-atomic="true"
                    className="flex min-w-0 flex-1 items-center gap-1.5"
                >
                    {refreshStatus === "refreshing" && (
                        <LoaderCircle
                            aria-hidden="true"
                            className="size-3 shrink-0 animate-spin motion-reduce:animate-none"
                        />
                    )}
                    <span className="truncate">
                        {refreshStatus === "refreshing"
                            ? "Refreshing cached results..."
                            : refreshStatus === "paused"
                              ? "Offline - results may be outdated"
                              : refreshStatus === "error"
                                ? "Refresh failed - results may be outdated"
                                : null}
                    </span>
                </div>
                <div className="flex w-20 shrink-0 items-center justify-center">
                    <span>Assignee</span>
                </div>
                <div className="flex w-16 shrink-0 items-center justify-end">
                    <span>Comments</span>
                </div>
            </div>

            <div>{showLoading ? skeleton : isEmpty ? emptyState : rows}</div>

            {!showLoading && !isEmpty && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={onPageChange}
                />
            )}
        </div>
    );
}
