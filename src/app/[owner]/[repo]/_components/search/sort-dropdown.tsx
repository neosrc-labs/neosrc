"use client";

import { ChevronDown, ListOrdered } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

const SORT_OPTIONS: {
    label: string;
    sort: "created" | "updated" | "comments";
    order: "asc" | "desc";
}[] = [
    { label: "Newest", sort: "created", order: "desc" },
    { label: "Oldest", sort: "created", order: "asc" },
    { label: "Recently updated", sort: "updated", order: "desc" },
    { label: "Most commented", sort: "comments", order: "desc" },
];

export function SortDropdown({
    currentSort,
    currentOrder,
    onSelect,
}: {
    currentSort: string;
    currentOrder: string;
    onSelect: (
        sort: "created" | "updated" | "comments",
        order: "asc" | "desc",
    ) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const currentLabel =
        SORT_OPTIONS.find(
            (o) => o.sort === currentSort && o.order === currentOrder,
        )?.label ?? "Newest";

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
                <ListOrdered className="size-4" />
                {currentLabel}
                <ChevronDown className="size-3.5 text-gray-400" />
            </button>
            {open && (
                <div className="absolute top-full right-0 z-50 mt-1 w-44 rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                    {SORT_OPTIONS.map((opt) => (
                        <button
                            key={opt.label}
                            type="button"
                            onClick={() => {
                                onSelect(opt.sort, opt.order);
                                setOpen(false);
                            }}
                            className={cn(
                                "flex w-full cursor-pointer items-center rounded-md px-3 py-1.5 text-sm transition-colors",
                                opt.sort === currentSort &&
                                    opt.order === currentOrder
                                    ? "bg-gray-100 font-medium text-gray-900 dark:bg-zinc-800 dark:text-zinc-100"
                                    : "text-gray-700 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
