"use client";

import {
    AlertTriangle,
    CheckSquare,
    Code2,
    Search,
    Table,
    ToggleLeft,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const ALERT_TYPES = ["Note", "Tip", "Important", "Warning", "Caution"] as const;

interface MenuItem {
    id: string;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
}

const MENU_ITEMS: MenuItem[] = [
    {
        id: "table",
        label: "Table",
        description: "Insert a markdown table",
        icon: Table,
    },
    {
        id: "alert",
        label: "Alert",
        description: "Insert a GitHub alert blockquote",
        icon: AlertTriangle,
    },
    {
        id: "details",
        label: "Details",
        description: "Insert a collapsible details block",
        icon: ToggleLeft,
    },
    {
        id: "codeblock",
        label: "Code block",
        description: "Insert a fenced code block",
        icon: Code2,
    },
    {
        id: "tasklist",
        label: "Task list",
        description: "Insert a task list",
        icon: CheckSquare,
    },
];

const MAX_GRID = 10;

interface SlashCommandMenuProps {
    style?: React.CSSProperties;
    view: "menu" | "table-form" | "alert-form";
    onCommandSelect: (commandId: string) => void;
    onInsertTable: (columns: number, rows: number) => void;
    selectedAlertType: string;
    onSelectAlertType: (type: string) => void;
    onBackToMenu: () => void;
    onClose: () => void;
}

export function SlashCommandMenu({
    style,
    view,
    onCommandSelect,
    onInsertTable,
    selectedAlertType,
    onSelectAlertType,
    onBackToMenu,
    onClose,
}: SlashCommandMenuProps) {
    const listRef = useRef<HTMLUListElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const [search, setSearch] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [gridCol, setGridCol] = useState(3);
    const [gridRow, setGridRow] = useState(3);

    useEffect(() => {
        if (view === "menu") {
            inputRef.current?.focus();
            setSearch("");
            setSelectedIndex(0);
        }
        if (view === "table-form") {
            setGridCol(3);
            setGridRow(3);
            gridRef.current?.focus();
        }
    }, [view]);

    const filteredItems = MENU_ITEMS.filter((item) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            item.label.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q)
        );
    });

    useEffect(() => {
        if (listRef.current && selectedIndex >= 0) {
            const items = listRef.current.querySelectorAll("li");
            const item = items[selectedIndex] as HTMLElement | undefined;
            item?.scrollIntoView({ block: "nearest" });
        }
    }, [selectedIndex]);

    const baseStyle =
        "absolute z-50 w-72 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900";

    function handleMenuKeyDown(e: React.KeyboardEvent) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((i) =>
                i >= filteredItems.length - 1 ? 0 : i + 1,
            );
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((i) =>
                i <= 0 ? filteredItems.length - 1 : i - 1,
            );
        } else if (e.key === "Enter") {
            e.preventDefault();
            const item = filteredItems[selectedIndex];
            if (item) {
                onCommandSelect(item.id);
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
        }
    }

    if (view === "table-form") {
        return (
            <div className={baseStyle} data-autocomplete="true" style={style}>
                <div className="flex items-center justify-between px-3 py-2">
                    <span className="font-medium text-sm text-text-label dark:text-zinc-200">
                        Insert table
                    </span>
                    <span className="font-medium text-text-tertiary text-xs tabular-nums">
                        {gridCol} &times; {gridRow}
                    </span>
                </div>
                <div
                    className="flex place-items-center px-4 pb-2"
                    onMouseLeave={() => {
                        setGridCol(3);
                        setGridRow(3);
                    }}
                >
                    <div
                        className="grid grid-cols-[repeat(10,16px)] gap-0.5 focus:outline-none"
                        ref={gridRef}
                        onKeyDown={(e) => {
                            if (e.key === "ArrowRight") {
                                e.preventDefault();
                                setGridCol((c) => Math.min(MAX_GRID, c + 1));
                            } else if (e.key === "ArrowLeft") {
                                e.preventDefault();
                                setGridCol((c) => Math.max(1, c - 1));
                            } else if (e.key === "ArrowDown") {
                                e.preventDefault();
                                setGridRow((r) => Math.min(MAX_GRID, r + 1));
                            } else if (e.key === "ArrowUp") {
                                e.preventDefault();
                                setGridRow((r) => Math.max(1, r - 1));
                            } else if (e.key === "Enter") {
                                e.preventDefault();
                                onInsertTable(gridCol, gridRow);
                            } else if (e.key === "Escape") {
                                e.preventDefault();
                                onClose();
                            }
                        }}
                        // biome-ignore lint/a11y/noNoninteractiveTabindex: grid needs keyboard nav
                        tabIndex={0}
                    >
                        {Array.from({ length: MAX_GRID }, (_, r) =>
                            Array.from({ length: MAX_GRID }, (_, c) => {
                                const active =
                                    c + 1 <= gridCol && r + 1 <= gridRow;
                                return (
                                    <button
                                        className={`h-4 w-4 rounded-sm border transition-colors ${
                                            active
                                                ? "border-blue-500 bg-blue-500/20 dark:border-blue-400 dark:bg-blue-400/20"
                                                : "border-gray-300 bg-white hover:border-gray-400 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:border-zinc-500"
                                        }`}
                                        // biome-ignore lint/suspicious/noArrayIndexKey: grid is static
                                        key={`${r}-${c}`}
                                        onClick={() => {
                                            onInsertTable(gridCol, gridRow);
                                        }}
                                        onMouseEnter={() => {
                                            setGridCol(c + 1);
                                            setGridRow(r + 1);
                                        }}
                                        type="button"
                                    />
                                );
                            }),
                        )}
                    </div>
                </div>
                <div className="flex items-center justify-between border-gray-200 border-t px-3 py-2 dark:border-zinc-700">
                    <button
                        className="cursor-pointer text-text-tertiary text-xs hover:text-text-label dark:hover:text-zinc-200"
                        onClick={onBackToMenu}
                        type="button"
                    >
                        Back
                    </button>
                </div>
            </div>
        );
    }

    if (view === "alert-form") {
        return (
            <div
                className={baseStyle}
                data-autocomplete="true"
                onKeyDown={(e) => {
                    if (e.key === "Escape") {
                        e.preventDefault();
                        onClose();
                    }
                }}
                style={style}
            >
                <div className="px-3 py-2 font-medium text-sm text-text-label dark:text-zinc-200">
                    Choose alert type
                </div>
                <ul ref={listRef} className="max-h-60 overflow-y-auto py-1">
                    {ALERT_TYPES.map((type) => (
                        <li
                            className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                                type === selectedAlertType
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                    : "text-text-label hover:bg-gray-50 dark:hover:bg-zinc-800"
                            }`}
                            key={type}
                            onClick={() => onSelectAlertType(type)}
                            onMouseDown={(e) => e.preventDefault()}
                        >
                            <span className="font-medium">{type}</span>
                        </li>
                    ))}
                </ul>
                <div className="border-gray-200 border-t px-3 py-2 dark:border-zinc-700">
                    <button
                        className="cursor-pointer text-text-tertiary text-xs hover:text-text-label dark:hover:text-zinc-200"
                        onClick={onBackToMenu}
                        type="button"
                    >
                        Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={baseStyle} data-autocomplete="true" style={style}>
            <div className="relative border-gray-200 border-b dark:border-zinc-700">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" />
                <input
                    autoFocus
                    className="w-full bg-transparent px-3 py-2.5 pl-9 text-sm outline-none placeholder:text-text-muted dark:text-zinc-100"
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setSelectedIndex(0);
                    }}
                    onKeyDown={handleMenuKeyDown}
                    placeholder="Search commands..."
                    ref={inputRef}
                    type="text"
                    value={search}
                />
            </div>
            {filteredItems.length === 0 ? (
                <div className="px-3 py-4 text-center text-text-tertiary text-xs">
                    No commands found
                </div>
            ) : (
                <ul ref={listRef} className="max-h-60 overflow-y-auto py-1">
                    {filteredItems.map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <li
                                className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${
                                    index === selectedIndex
                                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                        : "text-text-label hover:bg-gray-50 dark:hover:bg-zinc-800"
                                }`}
                                key={item.id}
                                onClick={() => onCommandSelect(item.id)}
                                onMouseDown={(e) => e.preventDefault()}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <Icon className="size-4 shrink-0 opacity-70" />
                                <div className="flex flex-col">
                                    <span className="font-medium">
                                        {item.label}
                                    </span>
                                    <span className="text-text-tertiary text-xs">
                                        {item.description}
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
