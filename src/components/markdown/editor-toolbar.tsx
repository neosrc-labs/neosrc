"use client";

import {
    AlertTriangle,
    Bold,
    Code,
    Code2,
    Heading,
    Italic,
    Link,
    List,
    ListOrdered,
    ListTodo,
    Strikethrough,
    Table,
    TextQuote,
    ToggleLeft,
} from "lucide-react";
import { generateDetails } from "./accessories/markdown-utils";

interface EditorToolbarProps {
    mode: "write" | "preview";
    onModeChange: (mode: "write" | "preview") => void;
    disabled: boolean;
    savedSelectionRef: React.RefObject<{ start: number; end: number }>;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    onToolbarInsert: (generated: { text: string; cursorPos: number }) => void;
    onOpenSlashForm: (view: "table-form" | "alert-form") => void;
    onBold: () => void;
    onItalic: () => void;
    onHeading: () => void;
    onStrikethrough: () => void;
    onUnorderedList: () => void;
    onOrderedList: () => void;
    onTaskList: () => void;
    onBlockquote: () => void;
    onCode: () => void;
    onCodeBlock: () => void;
    onLink: () => void;
}

export function EditorToolbar({
    mode,
    onModeChange,
    disabled,
    savedSelectionRef,
    textareaRef,
    onToolbarInsert,
    onOpenSlashForm,
    onBold,
    onItalic,
    onHeading,
    onStrikethrough,
    onUnorderedList,
    onOrderedList,
    onTaskList,
    onBlockquote,
    onCode,
    onCodeBlock,
    onLink,
}: EditorToolbarProps) {
    const isMac =
        typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
    const tooltipMod = isMac ? "⌘" : "Ctrl";

    const toolbarGroups = [
        [
            {
                icon: Bold,
                key: "bold",
                title: `Bold (${tooltipMod}+B)`,
                onClick: onBold,
            },
            {
                icon: Italic,
                key: "italic",
                title: `Italic (${tooltipMod}+I)`,
                onClick: onItalic,
            },
            {
                icon: Heading,
                key: "heading",
                title: "Heading",
                onClick: onHeading,
            },
            {
                icon: Strikethrough,
                key: "strikethrough",
                title: "Strikethrough",
                onClick: onStrikethrough,
            },
        ],
        [
            {
                icon: List,
                key: "unordered-list",
                title: "Unordered list",
                onClick: onUnorderedList,
            },
            {
                icon: ListOrdered,
                key: "ordered-list",
                title: "Ordered list",
                onClick: onOrderedList,
            },
            {
                icon: ListTodo,
                key: "task-list",
                title: "Task list",
                onClick: onTaskList,
            },
            {
                icon: TextQuote,
                key: "blockquote",
                title: "Blockquote",
                onClick: onBlockquote,
            },
        ],
        [
            {
                icon: Code,
                key: "code",
                title: "Inline code",
                onClick: onCode,
            },
            {
                icon: Code2,
                key: "codeblock",
                title: `Code block (${tooltipMod}+Shift+K)`,
                onClick: onCodeBlock,
            },
            {
                icon: Link,
                key: "link",
                title: `Link (${tooltipMod}+K)`,
                onClick: onLink,
            },
        ],
        [
            {
                icon: Table,
                key: "table-insert",
                title: "Insert table",
                onClick: () => onOpenSlashForm("table-form"),
            },
            {
                icon: AlertTriangle,
                key: "alert-insert",
                title: "Insert alert",
                onClick: () => onOpenSlashForm("alert-form"),
            },
            {
                icon: ToggleLeft,
                key: "details-insert",
                title: "Insert details block",
                onClick: () => onToolbarInsert(generateDetails()),
            },
        ],
    ];

    return (
        <div className="flex flex-wrap items-center gap-1 border-gray-300 border-b bg-surface-secondary px-3 dark:border-zinc-600">
            <span className="flex items-center gap-3">
                <button
                    className={`cursor-pointer border-b-2 pt-2 pb-1.5 font-medium text-sm transition-colors ${
                        mode === "write"
                            ? "border-gray-900 text-text-primary dark:border-zinc-100"
                            : "border-transparent text-text-secondary hover:text-text-primary dark:hover:text-zinc-200"
                    }`}
                    onClick={() => onModeChange("write")}
                    type="button"
                >
                    Write
                </button>
                <button
                    className={`cursor-pointer border-b-2 pt-2 pb-1.5 font-medium text-sm transition-colors ${
                        mode === "preview"
                            ? "border-gray-900 text-text-primary dark:border-zinc-100"
                            : "border-transparent text-text-secondary hover:text-text-primary dark:hover:text-zinc-200"
                    }`}
                    onClick={() => onModeChange("preview")}
                    type="button"
                >
                    Preview
                </button>
            </span>
            {mode === "write" && (
                <span className="ml-auto flex items-center gap-0.5">
                    {toolbarGroups.map((group, gi) => (
                        <span
                            className="flex items-center gap-0.5"
                            // biome-ignore lint/suspicious/noArrayIndexKey: toolbar groups are static
                            key={gi}
                        >
                            {gi > 0 && (
                                <span className="mx-1 w-px self-stretch bg-gray-300 dark:bg-zinc-600" />
                            )}
                            {group.map((btn) => {
                                const Icon = btn.icon;
                                return (
                                    <button
                                        className="inline-flex cursor-pointer items-center justify-center rounded-md p-1 text-text-secondary hover:bg-surface-selected hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-zinc-200"
                                        disabled={disabled}
                                        key={btn.key}
                                        onMouseDown={(e) => {
                                            const textarea =
                                                textareaRef.current;
                                            if (textarea) {
                                                savedSelectionRef.current = {
                                                    start: textarea.selectionStart,
                                                    end: textarea.selectionEnd,
                                                };
                                            }
                                            e.preventDefault();
                                        }}
                                        onClick={btn.onClick}
                                        title={btn.title}
                                        aria-label={btn.title}
                                        type="button"
                                    >
                                        <Icon className="size-4" />
                                    </button>
                                );
                            })}
                        </span>
                    ))}
                </span>
            )}
        </div>
    );
}
