"use client";

import type { ReactNode } from "react";
import { Pagination } from "~/components/ui/pagination";

export function SearchListLayout({
    searchBar,
    toolbar,
    showLoading,
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
                <div className="flex-1" />
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
