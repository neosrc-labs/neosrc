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
    const [selectedIndex, setSelectedIndex] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
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

    useEffect(() => {
        const el = listRef.current?.children[selectedIndex] as
            | HTMLElement
            | undefined;
        el?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

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
                <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-border bg-surface-elevated shadow-lg">
                    <input
                        autoFocus
                        className="w-full border-border border-b px-3 py-2 text-sm outline-none placeholder:text-text-muted dark:bg-zinc-900 dark:text-zinc-100"
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setSelectedIndex(0);
                            onSearchChangeRef.current?.(e.target.value);
                        }}
                        onKeyDown={(e) => {
                            if (filteredItems.length === 0) return;
                            if (e.key === "ArrowDown") {
                                e.preventDefault();
                                setSelectedIndex(
                                    (i) => (i + 1) % filteredItems.length,
                                );
                            } else if (e.key === "ArrowUp") {
                                e.preventDefault();
                                setSelectedIndex(
                                    (i) =>
                                        (i - 1 + filteredItems.length) %
                                        filteredItems.length,
                                );
                            } else if (e.key === "Enter") {
                                e.preventDefault();
                                const item = filteredItems[selectedIndex];
                                if (item) {
                                    onSelect(item);
                                    if (closeOnSelect) setOpen(false);
                                }
                            } else if (e.key === "Escape") {
                                e.preventDefault();
                                setOpen(false);
                            }
                        }}
                        placeholder={placeholder}
                        value={search}
                    />
                    <ul className="max-h-60 overflow-y-auto py-1" ref={listRef}>
                        {beforeItems}
                        {filteredItems.length === 0 ? (
                            <li className="px-3 py-2 text-text-muted text-xs">
                                {emptyText}
                            </li>
                        ) : (
                            filteredItems.map((item, idx) => {
                                const selected = isSelected(item);
                                return (
                                    <li
                                        className={cn(
                                            "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-surface-tertiary",
                                            selected &&
                                                "bg-blue-50 dark:bg-blue-950/30",
                                            idx === selectedIndex &&
                                                !selected &&
                                                "bg-surface-tertiary",
                                        )}
                                        key={keyFn(item)}
                                        onClick={() => {
                                            onSelect(item);
                                            if (closeOnSelect) setOpen(false);
                                        }}
                                        onMouseEnter={() =>
                                            setSelectedIndex(idx)
                                        }
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
