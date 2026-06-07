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

interface SlashCommandMenuProps {
    style?: React.CSSProperties;
    view: "menu" | "table-form" | "alert-form";
    onCommandSelect: (commandId: string) => void;
    tableColumns: number;
    tableRows: number;
    onTableColumnsChange: (cols: number) => void;
    onTableRowsChange: (rows: number) => void;
    onInsertTable: () => void;
    selectedAlertType: string;
    onSelectAlertType: (type: string) => void;
    onBackToMenu: () => void;
}

export function SlashCommandMenu({
    style,
    view,
    onCommandSelect,
    tableColumns,
    tableRows,
    onTableColumnsChange,
    onTableRowsChange,
    onInsertTable,
    selectedAlertType,
    onSelectAlertType,
    onBackToMenu,
}: SlashCommandMenuProps) {
    const listRef = useRef<HTMLUListElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [search, setSearch] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
        if (view === "menu") {
            inputRef.current?.focus();
            setSearch("");
            setSelectedIndex(0);
        }
        if (view === "table-form") {
            inputRef.current?.focus();
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
        }
    }

    if (view === "table-form") {
        return (
            <div className={baseStyle} data-autocomplete="true" style={style}>
                <div className="px-3 py-2 font-medium text-gray-700 text-sm dark:text-zinc-200">
                    Insert table
                </div>
                <div className="flex items-center gap-2 px-3 pb-2">
                    <label className="flex items-center gap-1 text-gray-600 text-xs dark:text-zinc-400">
                        Columns
                        <input
                            className="w-14 rounded border border-gray-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                            max={10}
                            min={1}
                            onChange={(e) => {
                                const v = Number(e.target.value);
                                if (v >= 1 && v <= 10) onTableColumnsChange(v);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    onInsertTable();
                                }
                            }}
                            ref={inputRef}
                            type="number"
                            value={tableColumns}
                        />
                    </label>
                    <label className="flex items-center gap-1 text-gray-600 text-xs dark:text-zinc-400">
                        Rows
                        <input
                            className="w-14 rounded border border-gray-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                            max={10}
                            min={1}
                            onChange={(e) => {
                                const v = Number(e.target.value);
                                if (v >= 1 && v <= 10) onTableRowsChange(v);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    onInsertTable();
                                }
                            }}
                            type="number"
                            value={tableRows}
                        />
                    </label>
                </div>
                <div className="flex items-center justify-between border-gray-200 border-t px-3 py-2 dark:border-zinc-700">
                    <button
                        className="cursor-pointer text-gray-500 text-xs hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                        onClick={onBackToMenu}
                        type="button"
                    >
                        Back
                    </button>
                    <button
                        className="cursor-pointer rounded bg-blue-600 px-3 py-1 text-white text-xs hover:bg-blue-700"
                        onClick={onInsertTable}
                        type="button"
                    >
                        Insert
                    </button>
                </div>
            </div>
        );
    }

    if (view === "alert-form") {
        return (
            <div className={baseStyle} data-autocomplete="true" style={style}>
                <div className="px-3 py-2 font-medium text-gray-700 text-sm dark:text-zinc-200">
                    Choose alert type
                </div>
                <ul ref={listRef} className="max-h-60 overflow-y-auto py-1">
                    {ALERT_TYPES.map((type) => (
                        <li
                            className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                                type === selectedAlertType
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                    : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-zinc-800"
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
                        className="cursor-pointer text-gray-500 text-xs hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
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
        <div
            className={baseStyle}
            data-autocomplete="true"
            onKeyDown={handleMenuKeyDown}
            style={style}
        >
            <div className="relative border-gray-200 border-b dark:border-zinc-700">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
                <input
                    autoFocus
                    className="w-full bg-transparent px-3 py-2.5 pl-9 text-sm outline-none placeholder:text-gray-400 dark:text-zinc-100"
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
                <div className="px-3 py-4 text-center text-gray-500 text-xs dark:text-zinc-500">
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
                                        : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-zinc-800"
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
                                    <span className="text-gray-500 text-xs dark:text-zinc-500">
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
