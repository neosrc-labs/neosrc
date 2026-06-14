"use client";

import { keepPreviousData } from "@tanstack/react-query";
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
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { IssueAutocomplete } from "./issue-autocomplete";
import { MarkdownRenderer } from "./MarkdownRenderer";
import {
    applyCodeBlockFormat,
    applyInlineFormat,
    applyListFormat,
    findLineStart,
    generateAlert,
    generateCodeBlock,
    generateDetails,
    generateTable,
    generateTaskList,
    handleEnterKey,
} from "./markdown-utils";
import { SlashCommandMenu } from "./slash-command-menu";

export interface FooterAction {
    label: string;
    onClick: () => void;
    variant?: "neutral" | "approve" | "danger";
    disabled?: boolean | ((text: string) => boolean);
}

interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    onCancel?: () => void;
    placeholder?: string;
    cancelLabel?: string;
    disabled?: boolean;
    minHeight?: string;
    className?: string;
    owner?: string;
    repo?: string;
    footerActions?: FooterAction[];
}

export function MarkdownEditor({
    value,
    onChange,
    onCancel,
    placeholder = "",
    cancelLabel = "Cancel",
    disabled = false,
    minHeight = "135px",
    className = "",
    owner,
    repo,
    footerActions,
}: MarkdownEditorProps) {
    const [mode, setMode] = useState<"write" | "preview">("write");
    const [autocompleteQuery, setAutocompleteQuery] = useState<string | null>(
        null,
    );
    const [autocompleteIndex, setAutocompleteIndex] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const cursorRef = useRef<{ start: number; end: number } | null>(null);
    const valueRef = useRef(value);
    const onChangeRef = useRef(onChange);
    const disabledRef = useRef(disabled);
    const containerRef = useRef<HTMLDivElement>(null);
    const savedSelectionRef = useRef({ start: 0, end: 0 });
    const [dropdownTop, setDropdownTop] = useState(80);
    const [slashMenuView, setSlashMenuView] = useState<
        "menu" | "table-form" | "alert-form" | null
    >(null);
    const [slashMenuPos, setSlashMenuPos] = useState<React.CSSProperties>({
        top: 80,
    });
    const [alertType, setAlertType] = useState("Note");
    const slashLinePosRef = useRef<number | null>(null);

    valueRef.current = value;
    onChangeRef.current = onChange;
    disabledRef.current = disabled;

    const {
        data: autocompleteIssues = [],
        isFetching: issuesLoading,
        isError: issuesError,
        error: issuesErrorObj,
    } = api.issues.searchAutocomplete.useQuery(
        {
            owner: owner ?? "",
            repo: repo ?? "",
            query: autocompleteQuery ?? "",
        },
        {
            enabled: autocompleteQuery !== null && !!owner && !!repo,
            staleTime: 30_000,
            placeholderData: keepPreviousData,
        },
    );

    function detectAutocomplete(
        text: string,
        cursorPos: number,
    ): string | null {
        const textBeforeCursor = text.slice(0, cursorPos);
        const match = textBeforeCursor.match(/(?:^|\s)(#[\w-]*)$/);
        if (!match?.[1]) return null;
        const query = match[1].slice(1);
        return query;
    }

    const dismissAutocomplete = useCallback(() => {
        setAutocompleteQuery(null);
        setAutocompleteIndex(0);
    }, []);

    const dismissSlashMenu = useCallback(() => {
        setSlashMenuView(null);
        const pos = slashLinePosRef.current;
        slashLinePosRef.current = null;
        setAlertType("Note");
        if (pos !== null) {
            cursorRef.current = { start: pos, end: pos };
        }
    }, []);

    function detectSlashCommand(
        text: string,
        cursorPos: number,
    ): "menu" | null {
        const textBeforeCursor = text.slice(0, cursorPos);
        const match = textBeforeCursor.match(/(?:\n|^)\/(\w*)$/);
        if (!match) return null;
        return "menu";
    }

    const handleSlashMenuItemSelect = useCallback(
        (itemId: string) => {
            if (itemId === "table") {
                setSlashMenuView("table-form");
                return;
            }
            if (itemId === "alert") {
                setSlashMenuView("alert-form");
                return;
            }

            const linePos = slashLinePosRef.current;
            if (linePos === null) return;

            let generated: { text: string; cursorPos: number };
            switch (itemId) {
                case "details": {
                    generated = generateDetails();
                    break;
                }
                case "codeblock": {
                    generated = generateCodeBlock();
                    break;
                }
                case "tasklist": {
                    generated = generateTaskList();
                    break;
                }
                default: {
                    return;
                }
            }

            const newText =
                valueRef.current.slice(0, linePos) +
                generated.text +
                valueRef.current.slice(linePos);
            const adjustedCursor = linePos + generated.cursorPos;
            cursorRef.current = { start: adjustedCursor, end: adjustedCursor };
            onChangeRef.current(newText);
            dismissSlashMenu();
            textareaRef.current?.focus();
        },
        [dismissSlashMenu],
    );

    const handleInsertTable = useCallback(
        (columns: number, rows: number) => {
            const linePos = slashLinePosRef.current;
            if (linePos === null) return;
            const generated = generateTable(columns, rows);
            const newText =
                valueRef.current.slice(0, linePos) +
                generated.text +
                valueRef.current.slice(linePos);
            const adjustedCursor = linePos + generated.cursorPos;
            cursorRef.current = { start: adjustedCursor, end: adjustedCursor };
            onChangeRef.current(newText);
            dismissSlashMenu();
            textareaRef.current?.focus();
        },
        [dismissSlashMenu],
    );

    const handleSelectAlertType = useCallback(
        (type: string) => {
            const linePos = slashLinePosRef.current;
            if (linePos === null) return;
            const generated = generateAlert(type);
            const newText =
                valueRef.current.slice(0, linePos) +
                generated.text +
                valueRef.current.slice(linePos);
            const adjustedCursor = linePos + generated.cursorPos;
            cursorRef.current = { start: adjustedCursor, end: adjustedCursor };
            onChangeRef.current(newText);
            dismissSlashMenu();
            textareaRef.current?.focus();
        },
        [dismissSlashMenu],
    );

    const handleSlashBackToMenu = useCallback(() => {
        setSlashMenuView("menu");
    }, []);

    const handleToolbarInsert = useCallback(
        (generated: { text: string; cursorPos: number }) => {
            const textarea = textareaRef.current;
            if (!textarea) return;
            const cursorPos = textarea.selectionStart;
            const newText =
                valueRef.current.slice(0, cursorPos) +
                generated.text +
                valueRef.current.slice(cursorPos);
            const newCursor = cursorPos + generated.cursorPos;
            cursorRef.current = { start: newCursor, end: newCursor };
            onChangeRef.current(newText);
        },
        [],
    );

    const handleAutocompleteSelect = useCallback(
        (issueNumber: number) => {
            const textarea = textareaRef.current;
            if (!textarea) return;
            const cursorPos = textarea.selectionStart;
            const textBeforeCursor = valueRef.current.slice(0, cursorPos);
            const match = textBeforeCursor.match(/(?:^|\s)(#[\w-]*)$/);
            if (!match) return;
            const hashStart =
                (match.index as number) + (match[0].startsWith("#") ? 0 : 1);
            const replaceEnd = cursorPos;
            const replacement = `#${issueNumber}`;
            const newText =
                valueRef.current.slice(0, hashStart) +
                replacement +
                valueRef.current.slice(replaceEnd);
            cursorRef.current = {
                start: hashStart + replacement.length,
                end: hashStart + replacement.length,
            };
            onChangeRef.current(newText);
            dismissAutocomplete();
        },
        [dismissAutocomplete],
    );

    // biome-ignore lint/correctness/useExhaustiveDependencies: need to re-run after value/menu changes to restore cursor
    useEffect(() => {
        if (cursorRef.current && textareaRef.current) {
            const { start, end } = cursorRef.current;
            textareaRef.current.setSelectionRange(start, end);
            cursorRef.current = null;
        }
    }, [value, slashMenuView]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: need to re-run after value changes to auto-resize
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = "auto";
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [value]);

    const applyFormatting = useCallback(
        (
            formatter: (
                text: string,
                cursorStart: number,
                cursorEnd: number,
            ) => { newText: string; newStart: number; newEnd: number },
        ) => {
            const textarea = textareaRef.current;
            if (!textarea || disabledRef.current) return;

            const isFocused = document.activeElement === textarea;
            const start = isFocused
                ? textarea.selectionStart
                : savedSelectionRef.current.start;
            const end = isFocused
                ? textarea.selectionEnd
                : savedSelectionRef.current.end;
            const { newText, newStart, newEnd } = formatter(
                valueRef.current,
                start,
                end,
            );

            cursorRef.current = { start: newStart, end: newEnd };
            onChangeRef.current(newText);
        },
        [],
    );

    const handleBold = useCallback(() => {
        applyFormatting((text, start, end) =>
            applyInlineFormat(text, start, end, "**", "bold"),
        );
    }, [applyFormatting]);

    const handleItalic = useCallback(() => {
        applyFormatting((text, start, end) =>
            applyInlineFormat(text, start, end, "_", "italic"),
        );
    }, [applyFormatting]);

    const handleHeading = useCallback(() => {
        applyFormatting((text, start, end) => {
            const lineStart = findLineStart(text, start);
            const prefix = "## ";
            return {
                newText:
                    text.slice(0, lineStart) + prefix + text.slice(lineStart),
                newStart: start + prefix.length,
                newEnd: end + prefix.length,
            };
        });
    }, [applyFormatting]);

    const handleStrikethrough = useCallback(() => {
        applyFormatting((text, start, end) =>
            applyInlineFormat(text, start, end, "~~", "strikethrough"),
        );
    }, [applyFormatting]);

    const handleCode = useCallback(() => {
        applyFormatting((text, start, end) =>
            applyInlineFormat(text, start, end, "`", "code"),
        );
    }, [applyFormatting]);

    const handleCodeBlock = useCallback(() => {
        applyFormatting((text, start, end) =>
            applyCodeBlockFormat(text, start, end),
        );
    }, [applyFormatting]);

    const handleLink = useCallback(() => {
        applyFormatting((text, start, end) => {
            const selected = text.slice(start, end);
            const linkText = selected || "text";
            return {
                newText: `${text.slice(0, start)}[${linkText}](url)${text.slice(end)}`,
                newStart: start + 1,
                newEnd: start + 1 + linkText.length,
            };
        });
    }, [applyFormatting]);

    const handleUnorderedList = useCallback(() => {
        applyFormatting((text, start, end) =>
            applyListFormat(text, start, end, "- "),
        );
    }, [applyFormatting]);

    const handleOrderedList = useCallback(() => {
        applyFormatting((text, start, end) =>
            applyListFormat(text, start, end, "1. "),
        );
    }, [applyFormatting]);

    const handleTaskList = useCallback(() => {
        applyFormatting((text, start, end) =>
            applyListFormat(text, start, end, "- [ ] "),
        );
    }, [applyFormatting]);

    const handleBlockquote = useCallback(() => {
        applyFormatting((text, start, end) => {
            const lineStart = findLineStart(text, start);
            const lineEnd = text.indexOf("\n", lineStart);
            const lineText =
                lineEnd === -1
                    ? text.slice(lineStart)
                    : text.slice(lineStart, lineEnd);
            const prefix = "> ";
            if (lineText.startsWith(prefix)) {
                return {
                    newText:
                        text.slice(0, lineStart) +
                        text.slice(lineStart + prefix.length),
                    newStart: Math.max(start - prefix.length, lineStart),
                    newEnd: Math.max(end - prefix.length, lineStart),
                };
            }
            return {
                newText:
                    text.slice(0, lineStart) + prefix + text.slice(lineStart),
                newStart: start + prefix.length,
                newEnd: end + prefix.length,
            };
        });
    }, [applyFormatting]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (autocompleteQuery !== null) {
                if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setAutocompleteIndex((i) => Math.max(0, i - 1));
                    return;
                }
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setAutocompleteIndex((i) => i + 1);
                    return;
                }
                if (e.key === "Enter") {
                    e.preventDefault();
                    const issue = autocompleteIssues[autocompleteIndex];
                    if (issue) {
                        handleAutocompleteSelect(issue.number);
                    }
                    return;
                }
                if (e.key === "Escape") {
                    e.preventDefault();
                    dismissAutocomplete();
                    return;
                }
            }

            if (slashMenuView !== null) {
                if (slashMenuView === "table-form") {
                    if (e.key === "Escape") {
                        e.preventDefault();
                        dismissSlashMenu();
                        return;
                    }
                    e.preventDefault();
                    return;
                }
                if (slashMenuView === "alert-form") {
                    const ALERT_TYPE_LIST = [
                        "Note",
                        "Tip",
                        "Important",
                        "Warning",
                        "Caution",
                    ] as const;
                    if (e.key === "ArrowUp") {
                        e.preventDefault();
                        const idx = ALERT_TYPE_LIST.indexOf(
                            alertType as (typeof ALERT_TYPE_LIST)[number],
                        );
                        const prev =
                            idx <= 0 ? ALERT_TYPE_LIST.length - 1 : idx - 1;
                        setAlertType(ALERT_TYPE_LIST[prev] ?? "Note");
                        return;
                    }
                    if (e.key === "ArrowDown") {
                        e.preventDefault();
                        const idx = ALERT_TYPE_LIST.indexOf(
                            alertType as (typeof ALERT_TYPE_LIST)[number],
                        );
                        const next =
                            idx >= ALERT_TYPE_LIST.length - 1 ? 0 : idx + 1;
                        setAlertType(ALERT_TYPE_LIST[next] ?? "Note");
                        return;
                    }
                    if (e.key === "Enter") {
                        e.preventDefault();
                        handleSelectAlertType(alertType);
                        return;
                    }
                    if (e.key === "Escape") {
                        e.preventDefault();
                        dismissSlashMenu();
                        return;
                    }
                    return;
                }
                if (e.key === "Escape") {
                    e.preventDefault();
                    dismissSlashMenu();
                    return;
                }
                e.preventDefault();
                return;
            }

            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "b") {
                e.preventDefault();
                handleBold();
            } else if (
                (e.metaKey || e.ctrlKey) &&
                !e.shiftKey &&
                e.key === "i"
            ) {
                e.preventDefault();
                handleItalic();
            } else if (
                (e.metaKey || e.ctrlKey) &&
                !e.shiftKey &&
                e.key === "k"
            ) {
                e.preventDefault();
                handleLink();
            } else if (
                (e.metaKey || e.ctrlKey) &&
                e.shiftKey &&
                (e.key === "k" || e.key === "K")
            ) {
                e.preventDefault();
                handleCodeBlock();
            } else if (e.key === "Enter") {
                const textarea = textareaRef.current;
                if (textarea) {
                    const result = handleEnterKey(
                        valueRef.current,
                        textarea.selectionStart,
                    );
                    if (result) {
                        e.preventDefault();
                        cursorRef.current = {
                            start: result.newCursorPos,
                            end: result.newCursorPos,
                        };
                        onChangeRef.current(result.newText);
                    }
                }
            } else if (e.key === "Escape") {
                onCancel?.();
            }
        },
        [
            autocompleteQuery,
            autocompleteIssues,
            autocompleteIndex,
            handleAutocompleteSelect,
            dismissAutocomplete,
            slashMenuView,
            dismissSlashMenu,
            alertType,
            handleSelectAlertType,
            handleBold,
            handleItalic,
            handleLink,
            handleCodeBlock,
            onCancel,
        ],
    );

    const isMac =
        typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
    const tooltipMod = isMac ? "⌘" : "Ctrl";

    const toolbarGroups = [
        [
            {
                icon: Bold,
                key: "bold",
                title: `Bold (${tooltipMod}+B)`,
                onClick: handleBold,
            },
            {
                icon: Italic,
                key: "italic",
                title: `Italic (${tooltipMod}+I)`,
                onClick: handleItalic,
            },
            {
                icon: Heading,
                key: "heading",
                title: "Heading",
                onClick: handleHeading,
            },
            {
                icon: Strikethrough,
                key: "strikethrough",
                title: "Strikethrough",
                onClick: handleStrikethrough,
            },
        ],
        [
            {
                icon: List,
                key: "unordered-list",
                title: "Unordered list",
                onClick: handleUnorderedList,
            },
            {
                icon: ListOrdered,
                key: "ordered-list",
                title: "Ordered list",
                onClick: handleOrderedList,
            },
            {
                icon: ListTodo,
                key: "task-list",
                title: "Task list",
                onClick: handleTaskList,
            },
            {
                icon: TextQuote,
                key: "blockquote",
                title: "Blockquote",
                onClick: handleBlockquote,
            },
        ],
        [
            {
                icon: Code,
                key: "code",
                title: "Inline code",
                onClick: handleCode,
            },
            {
                icon: Code2,
                key: "codeblock",
                title: `Code block (${tooltipMod}+Shift+K)`,
                onClick: handleCodeBlock,
            },
            {
                icon: Link,
                key: "link",
                title: `Link (${tooltipMod}+K)`,
                onClick: handleLink,
            },
        ],
        [
            {
                icon: Table,
                key: "table-insert",
                title: "Insert table",
                onClick: () => {
                    const textarea = textareaRef.current;
                    if (!textarea) return;
                    slashLinePosRef.current = textarea.selectionStart;
                    setSlashMenuPos({ top: 34, right: 8 });
                    setSlashMenuView("table-form");
                },
            },
            {
                icon: AlertTriangle,
                key: "alert-insert",
                title: "Insert alert",
                onClick: () => {
                    const textarea = textareaRef.current;
                    if (!textarea) return;
                    slashLinePosRef.current = textarea.selectionStart;
                    setSlashMenuPos({ top: 34, right: 8 });
                    setSlashMenuView("alert-form");
                },
            },
            {
                icon: ToggleLeft,
                key: "details-insert",
                title: "Insert details block",
                onClick: () => handleToolbarInsert(generateDetails()),
            },
        ],
    ];

    return (
        <div
            className={`relative rounded-lg border border-gray-300 dark:border-zinc-600 ${className}`}
            ref={containerRef}
        >
            <div className="overflow-hidden rounded-lg">
                <div className="flex flex-wrap items-center gap-1 border-gray-300 border-b bg-gray-50 px-3 dark:border-zinc-600 dark:bg-zinc-900">
                    <span className="flex items-center gap-3">
                        <button
                            className={`cursor-pointer border-b-2 pt-2 pb-1.5 font-medium text-sm transition-colors ${
                                mode === "write"
                                    ? "border-gray-900 text-gray-900 dark:border-zinc-100 dark:text-zinc-100"
                                    : "border-transparent text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                            }`}
                            onClick={() => setMode("write")}
                            type="button"
                        >
                            Write
                        </button>
                        <button
                            className={`cursor-pointer border-b-2 pt-2 pb-1.5 font-medium text-sm transition-colors ${
                                mode === "preview"
                                    ? "border-gray-900 text-gray-900 dark:border-zinc-100 dark:text-zinc-100"
                                    : "border-transparent text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                            }`}
                            onClick={() => setMode("preview")}
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
                                                className="inline-flex cursor-pointer items-center justify-center rounded-md p-1 text-gray-600 hover:bg-gray-200 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                                                disabled={disabled}
                                                key={btn.key}
                                                onMouseDown={(e) => {
                                                    const textarea =
                                                        textareaRef.current;
                                                    if (textarea) {
                                                        savedSelectionRef.current =
                                                            {
                                                                start: textarea.selectionStart,
                                                                end: textarea.selectionEnd,
                                                            };
                                                    }
                                                    e.preventDefault();
                                                }}
                                                onClick={btn.onClick}
                                                title={btn.title}
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

                {mode === "write" ? (
                    <textarea
                        className="w-full resize-y border-0 bg-white px-3 py-2 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-0 disabled:bg-gray-50 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 disabled:dark:bg-zinc-800"
                        disabled={disabled}
                        onBlur={(e) => {
                            savedSelectionRef.current = {
                                start: e.target.selectionStart,
                                end: e.target.selectionEnd,
                            };
                            setTimeout(() => {
                                if (
                                    document.activeElement?.closest(
                                        '[data-autocomplete="true"]',
                                    )
                                )
                                    return;
                                dismissAutocomplete();
                                dismissSlashMenu();
                            }, 100);
                        }}
                        onChange={(e) => {
                            if (slashMenuView === "menu") {
                                e.target.value = valueRef.current;
                                return;
                            }
                            const newValue = e.target.value;
                            const cursorPos = e.target.selectionStart;
                            onChangeRef.current(newValue);
                            if (!disabledRef.current && owner && repo) {
                                const q = detectAutocomplete(
                                    newValue,
                                    cursorPos,
                                );
                                setAutocompleteQuery(q);
                                setAutocompleteIndex(0);
                                if (q !== null) {
                                    const textarea = e.target;
                                    const lineNumber =
                                        newValue.slice(0, cursorPos).split("\n")
                                            .length - 1;
                                    const top =
                                        textarea.offsetTop +
                                        8 +
                                        (lineNumber + 1) * 20 -
                                        textarea.scrollTop;
                                    setDropdownTop(top);
                                }
                            }

                            const slashResult = detectSlashCommand(
                                newValue,
                                cursorPos,
                            );
                            if (
                                slashResult === "menu" &&
                                slashMenuView === null
                            ) {
                                const textarea = e.target;
                                const lineNumber =
                                    newValue.slice(0, cursorPos).split("\n")
                                        .length - 1;
                                const top =
                                    textarea.offsetTop +
                                    8 +
                                    (lineNumber + 1) * 20 -
                                    textarea.scrollTop;
                                const textBeforeCursor = newValue.slice(
                                    0,
                                    cursorPos,
                                );
                                const match =
                                    textBeforeCursor.match(/(?:\n|^)\/(\w*)$/);
                                if (match) {
                                    const slashPos =
                                        (match.index ?? 0) +
                                        (match[0].startsWith("\n") ? 1 : 0);
                                    slashLinePosRef.current = slashPos;
                                    const removedSlash =
                                        newValue.slice(0, slashPos) +
                                        newValue.slice(slashPos + 1);
                                    onChangeRef.current(removedSlash);
                                    cursorRef.current = {
                                        start: slashPos,
                                        end: slashPos,
                                    };
                                }
                                setSlashMenuPos({ top, left: 0 });
                                setSlashMenuView("menu");
                            } else if (
                                slashResult === null &&
                                slashMenuView !== null
                            ) {
                                dismissSlashMenu();
                            }
                        }}
                        onKeyDown={handleKeyDown}
                        onKeyUp={(e) => {
                            if (
                                autocompleteQuery !== null &&
                                [
                                    "ArrowLeft",
                                    "ArrowRight",
                                    "Home",
                                    "End",
                                ].includes(e.key)
                            ) {
                                const textarea = textareaRef.current;
                                if (textarea) {
                                    const q = detectAutocomplete(
                                        textarea.value,
                                        textarea.selectionStart,
                                    );
                                    if (q === null) {
                                        dismissAutocomplete();
                                    }
                                }
                            }
                            if (
                                slashMenuView !== null &&
                                [
                                    "ArrowLeft",
                                    "ArrowRight",
                                    "Home",
                                    "End",
                                    "Backspace",
                                ].includes(e.key)
                            ) {
                                const textarea = textareaRef.current;
                                if (textarea) {
                                    const result = detectSlashCommand(
                                        textarea.value,
                                        textarea.selectionStart,
                                    );
                                    if (result === null) {
                                        dismissSlashMenu();
                                    }
                                }
                            }
                        }}
                        placeholder={placeholder}
                        ref={textareaRef}
                        style={{ minHeight }}
                        value={value}
                    />
                ) : (
                    <div
                        className="prose prose-sm dark:prose-invert max-w-none bg-white px-3 py-2 dark:bg-zinc-950"
                        style={{ minHeight }}
                    >
                        <MarkdownRenderer
                            content={value}
                            owner={owner}
                            repo={repo}
                            onToggleTask={(newContent) => onChange(newContent)}
                        />
                    </div>
                )}

                {(footerActions || onCancel) && (
                    <div className="flex items-center justify-between gap-2 border-gray-300 border-t bg-gray-50 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900">
                        {onCancel ? (
                            <button
                                className="cursor-pointer rounded-md border border-gray-300 px-4 py-1.5 font-medium text-gray-600 text-sm transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                                disabled={disabled}
                                onClick={onCancel}
                                type="button"
                            >
                                {cancelLabel}
                            </button>
                        ) : (
                            <div />
                        )}
                        {footerActions && (
                            <div className="flex items-center gap-2">
                                {footerActions.map((action) => (
                                    <button
                                        className={`cursor-pointer rounded-md px-4 py-1.5 font-medium text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                            action.variant === "approve"
                                                ? "bg-[#2da44e] text-white hover:bg-[#218838]"
                                                : action.variant === "danger"
                                                  ? "bg-[#cf222e] text-white hover:bg-[#b91c23]"
                                                  : "bg-neutral-200 text-black hover:bg-neutral-300"
                                        }`}
                                        disabled={
                                            disabled ||
                                            (typeof action.disabled ===
                                            "function"
                                                ? action.disabled(value)
                                                : action.disabled)
                                        }
                                        key={action.label}
                                        onClick={action.onClick}
                                        type="button"
                                    >
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {mode === "write" &&
                autocompleteQuery !== null &&
                owner &&
                repo &&
                !issuesLoading &&
                autocompleteIssues.length > 0 && (
                    <IssueAutocomplete
                        issues={autocompleteIssues}
                        loading={issuesLoading}
                        error={
                            issuesError
                                ? (issuesErrorObj?.message ?? "Unknown error")
                                : null
                        }
                        selectedIndex={autocompleteIndex}
                        onSelect={handleAutocompleteSelect}
                        style={{ top: dropdownTop }}
                    />
                )}
            {mode === "write" && slashMenuView !== null && (
                <SlashCommandMenu
                    style={slashMenuPos}
                    view={slashMenuView}
                    onCommandSelect={handleSlashMenuItemSelect}
                    onInsertTable={handleInsertTable}
                    selectedAlertType={alertType}
                    onSelectAlertType={handleSelectAlertType}
                    onBackToMenu={handleSlashBackToMenu}
                    onClose={() => {
                        dismissSlashMenu();
                        textareaRef.current?.focus();
                    }}
                />
            )}
        </div>
    );
}
