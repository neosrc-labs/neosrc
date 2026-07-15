"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "~/lib/utils";

type PageItem =
    | { type: "page"; value: number }
    | { type: "ellipsis"; key: string };

function getPageNumbers(currentPage: number, totalPages: number): PageItem[] {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => ({
            type: "page" as const,
            value: i + 1,
        }));
    }

    if (currentPage <= 4) {
        return [
            { type: "page", value: 1 },
            { type: "page", value: 2 },
            { type: "page", value: 3 },
            { type: "page", value: 4 },
            { type: "page", value: 5 },
            { type: "ellipsis", key: "right" },
            { type: "page", value: totalPages },
        ];
    }

    if (currentPage >= totalPages - 3) {
        return [
            { type: "page", value: 1 },
            { type: "ellipsis", key: "left" },
            { type: "page", value: totalPages - 4 },
            { type: "page", value: totalPages - 3 },
            { type: "page", value: totalPages - 2 },
            { type: "page", value: totalPages - 1 },
            { type: "page", value: totalPages },
        ];
    }

    return [
        { type: "page", value: 1 },
        { type: "ellipsis", key: "left" },
        { type: "page", value: currentPage - 2 },
        { type: "page", value: currentPage - 1 },
        { type: "page", value: currentPage },
        { type: "page", value: currentPage + 1 },
        { type: "page", value: currentPage + 2 },
        { type: "ellipsis", key: "right" },
        { type: "page", value: totalPages },
    ];
}

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export function Pagination({
    currentPage,
    totalPages,
    onPageChange,
}: PaginationProps) {
    if (totalPages <= 1) return null;

    const pages = getPageNumbers(currentPage, totalPages);

    const btnBase =
        "inline-flex items-center justify-center rounded-md px-3 py-1.5 font-medium text-sm transition-colors";
    const btnActive =
        "cursor-pointer text-text-label hover:bg-gray-100 hover:text-text-primary dark:hover:bg-zinc-800 dark:hover:text-zinc-100";
    const btnDisabled = "cursor-not-allowed text-text-muted";
    const btnCurrent =
        "cursor-default bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300";

    return (
        <nav
            aria-label="Pagination"
            className="flex items-center justify-center gap-2 border-gray-200 border-t px-4 py-3 dark:border-zinc-800"
        >
            <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
                className={cn(
                    btnBase,
                    currentPage <= 1 ? btnDisabled : btnActive,
                )}
            >
                <ChevronLeft className="size-4" />
                Previous
            </button>

            <div className="flex items-center gap-1">
                {pages.map((item) =>
                    item.type === "ellipsis" ? (
                        <span
                            key={item.key}
                            className="px-2 text-sm text-text-muted"
                        >
                            ...
                        </span>
                    ) : (
                        <button
                            key={item.value}
                            type="button"
                            disabled={item.value === currentPage}
                            onClick={() => onPageChange(item.value)}
                            className={cn(
                                btnBase,
                                "min-w-[2rem]",
                                item.value === currentPage
                                    ? btnCurrent
                                    : btnActive,
                            )}
                            aria-current={
                                item.value === currentPage ? "page" : undefined
                            }
                        >
                            {item.value}
                        </button>
                    ),
                )}
            </div>

            <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                className={cn(
                    btnBase,
                    currentPage >= totalPages ? btnDisabled : btnActive,
                )}
            >
                Next
                <ChevronRight className="size-4" />
            </button>
        </nav>
    );
}
