"use client";

import { Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

interface SearchableDropdownProps<T> {
    items: T[];
    isSelected: (item: T) => boolean;
    onSelect: (item: T) => void;
    keyFn: (item: T) => string | number;
    searchFn: (item: T, query: string) => boolean;
    renderItem: (item: T, selected: boolean) => React.ReactNode;
    placeholder: string;
    emptyText: string;
    ariaLabel: string;
    beforeItems?: React.ReactNode;
    disabled?: boolean;
    trigger?: React.ReactNode;
    onSearchChange?: (query: string) => void;
    closeOnSelect?: boolean;
}

export function SearchableDropdown<T>({
    items,
    isSelected,
    onSelect,
    keyFn,
    searchFn,
    renderItem,
    placeholder,
    emptyText,
    ariaLabel,
    beforeItems,
    disabled,
    trigger,
    onSearchChange,
    closeOnSelect,
}: SearchableDropdownProps<T>) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);
    const onSearchChangeRef = useRef(onSearchChange);
    onSearchChangeRef.current = onSearchChange;

    useEffect(() => {
        if (!open) {
            setSearch("");
            onSearchChangeRef.current?.("");
            return;
        }
        const handler = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const sortedCache = useRef<T[] | null>(null);
    const prevItemsRef = useRef(items);
    if (open && items && items !== prevItemsRef.current) {
        sortedCache.current = null;
        prevItemsRef.current = items;
    }
    if (open && items && !sortedCache.current) {
        sortedCache.current = [...items].sort((a, b) => {
            const aApplied = isSelected(a) ? 0 : 1;
            const bApplied = isSelected(b) ? 0 : 1;
            return aApplied - bApplied;
        });
    }
    if (!open) {
        sortedCache.current = null;
    }

    const sourceItems = sortedCache.current ?? items;
    const filteredItems = sourceItems.filter((item) => searchFn(item, search));

    if (disabled) {
        return null;
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {trigger ? (
                <div onClick={() => setOpen(!open)}>{trigger}</div>
            ) : (
                <button
                    className="cursor-pointer rounded p-0.5 text-text-muted hover:text-text-secondary dark:hover:text-zinc-300"
                    onClick={() => setOpen(!open)}
                    type="button"
                    aria-label={ariaLabel}
                >
                    <Settings size={14} />
                </button>
            )}
            {open && (
                <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                    <input
                        autoFocus
                        className="w-full border-gray-200 border-b px-3 py-2 text-sm outline-none placeholder:text-text-muted dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        onChange={(e) => {
                            setSearch(e.target.value);
                            onSearchChangeRef.current?.(e.target.value);
                        }}
                        placeholder={placeholder}
                        value={search}
                    />
                    <ul className="max-h-60 overflow-y-auto py-1">
                        {beforeItems}
                        {filteredItems.length === 0 ? (
                            <li className="px-3 py-2 text-text-muted text-xs">
                                {emptyText}
                            </li>
                        ) : (
                            filteredItems.map((item) => {
                                const selected = isSelected(item);
                                return (
                                    <li
                                        className={cn(
                                            "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-800",
                                            selected &&
                                                "bg-blue-50 dark:bg-blue-950/30",
                                        )}
                                        key={keyFn(item)}
                                        onClick={() => {
                                            onSelect(item);
                                            if (closeOnSelect) setOpen(false);
                                        }}
                                        role="option"
                                        aria-selected={selected}
                                    >
                                        {renderItem(item, selected)}
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
