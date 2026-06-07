"use client";

import {
    AlertTriangle,
    CheckSquare,
    Code2,
    Table,
    ToggleLeft,
} from "lucide-react";
import { useEffect, useRef } from "react";

const ALERT_TYPES = ["Note", "Tip", "Important", "Warning", "Caution"] as const;

const MENU_ITEMS = [
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
] as const;

interface SlashCommandMenuProps {
    style?: React.CSSProperties;
    view: "menu" | "table-form" | "alert-form";
    selectedIndex: number;
    onSelectItem: (index: number) => void;
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
    selectedIndex,
    onSelectItem,
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

    useEffect(() => {
        if (view === "table-form") {
            inputRef.current?.focus();
        }
    }, [view]);

    useEffect(() => {
        if (listRef.current && selectedIndex >= 0) {
            const item = listRef.current.children[selectedIndex] as
                | HTMLElement
                | undefined;
            item?.scrollIntoView({ block: "nearest" });
        }
    }, [selectedIndex]);

    const baseStyle =
        "absolute z-50 w-72 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900";

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
                    {ALERT_TYPES.map((type, _index) => (
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
        <div className={baseStyle} data-autocomplete="true" style={style}>
            <div className="px-3 py-2 font-medium text-gray-700 text-sm dark:text-zinc-200">
                Commands
            </div>
            <ul ref={listRef} className="max-h-60 overflow-y-auto py-1">
                {MENU_ITEMS.map((item, index) => {
                    const Icon = item.icon;
                    return (
                        <li
                            className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${
                                index === selectedIndex
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                    : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-zinc-800"
                            }`}
                            key={item.id}
                            onClick={() => onSelectItem(index)}
                            onMouseDown={(e) => e.preventDefault()}
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
        </div>
    );
}
