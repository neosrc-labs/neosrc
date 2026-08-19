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
import {
    Fragment,
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "~/components/ui/tooltip";
import { api } from "~/trpc/react";
import {
    IssueAutocomplete,
    type IssueItem,
} from "./accessories/issue-autocomplete";
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
} from "./accessories/markdown-utils";
import { SlashCommandMenu } from "./accessories/slash-command-menu";
import { MarkdownRenderer } from "./markdown-renderer";

export interface FooterAction {
    label: string;
    onClick: () => void;
    variant?: "neutral" | "approve" | "danger" | "outline";
    disabled?: boolean | ((text: string) => boolean);
    icon?: ReactNode;
    tooltip?: string;
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
    autoFocus?: boolean;
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
    autoFocus = false,
    owner,
    repo,
    footerActions,
}: MarkdownEditorProps) {
    const [mode, setMode] = useState<"write" | "preview">("write");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const cursorRef = useRef<{ start: number; end: number } | null>(null);
    const valueRef = useRef(value);
    const onChangeRef = useRef(onChange);
    const disabledRef = useRef(disabled);
    const containerRef = useRef<HTMLDivElement>(null);
    const savedSelectionRef = useRef({ start: 0, end: 0 });

    valueRef.current = value;
    onChangeRef.current = onChange;
    disabledRef.current = disabled;

    const {
        autocompleteQuery,
        autocompleteIndex,
        autocompleteIssues,
        issuesLoading,
        autocompleteError,
        dropdownTop,
        slashMenuView,
        slashMenuPos,
        alertType,
        setAutocompleteIndex,
        setAlertType,
        dismissAutocomplete,
        dismissSlashMenu,
        handleSlashMenuItemSelect,
        handleInsertTable,
        handleSelectAlertType,
        handleSlashBackToMenu,
        handleAutocompleteSelect,
        openSlashForm,
        handleTextareaChange,
        handleTextareaBlur,
        handleTextareaKeyUp,
    } = useSlashAutocomplete({
        owner,
        repo,
        textareaRef,
        cursorRef,
        valueRef,
        onChangeRef,
        disabledRef,
        savedSelectionRef,
    });

    const {
        handleToolbarInsert,
        handleBold,
        handleItalic,
        handleHeading,
        handleStrikethrough,
        handleCode,
        handleCodeBlock,
        handleLink,
        handleUnorderedList,
        handleOrderedList,
        handleTaskList,
        handleBlockquote,
    } = useFormattingHandlers({
        textareaRef,
        savedSelectionRef,
        disabledRef,
        valueRef,
        onChangeRef,
        cursorRef,
    });

    // biome-ignore lint/correctness/useExhaustiveDependencies: setters are stable across renders
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

    return (
        <div
            className={`relative rounded-lg border border-gray-300 dark:border-zinc-600 ${className}`}
            ref={containerRef}
        >
            <div className="overflow-hidden rounded-lg">
                <EditorToolbar
                    mode={mode}
                    onModeChange={setMode}
                    disabled={disabled}
                    savedSelectionRef={savedSelectionRef}
                    textareaRef={textareaRef}
                    onToolbarInsert={handleToolbarInsert}
                    onOpenSlashForm={openSlashForm}
                    onBold={handleBold}
                    onItalic={handleItalic}
                    onHeading={handleHeading}
                    onStrikethrough={handleStrikethrough}
                    onUnorderedList={handleUnorderedList}
                    onOrderedList={handleOrderedList}
                    onTaskList={handleTaskList}
                    onBlockquote={handleBlockquote}
                    onCode={handleCode}
                    onCodeBlock={handleCodeBlock}
                    onLink={handleLink}
                />
                <EditorTextarea
                    mode={mode}
                    value={value}
                    placeholder={placeholder}
                    minHeight={minHeight}
                    autoFocus={autoFocus}
                    disabled={disabled}
                    textareaRef={textareaRef}
                    onTextChange={handleTextareaChange}
                    onBlur={handleTextareaBlur}
                    onKeyDown={handleKeyDown}
                    onKeyUp={handleTextareaKeyUp}
                    owner={owner}
                    repo={repo}
                    onToggleTask={onChange}
                />
                <EditorFooter
                    onCancel={onCancel}
                    cancelLabel={cancelLabel}
                    disabled={disabled}
                    footerActions={footerActions}
                    value={value}
                />
            </div>

            <EditorPopovers
                mode={mode}
                autocompleteQuery={autocompleteQuery}
                owner={owner}
                repo={repo}
                autocompleteIssues={autocompleteIssues}
                issuesLoading={issuesLoading}
                autocompleteError={autocompleteError}
                autocompleteIndex={autocompleteIndex}
                onAutocompleteSelect={handleAutocompleteSelect}
                dropdownTop={dropdownTop}
                slashMenuView={slashMenuView}
                slashMenuPos={slashMenuPos}
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
        </div>
    );
}

function detectAutocomplete(text: string, cursorPos: number): string | null {
    const textBeforeCursor = text.slice(0, cursorPos);
    const match = textBeforeCursor.match(/(?:^|\s)(#[\w-]*)$/);
    if (!match?.[1]) return null;
    const query = match[1].slice(1);
    return query;
}

function detectSlashCommand(text: string, cursorPos: number): "menu" | null {
    const textBeforeCursor = text.slice(0, cursorPos);
    const match = textBeforeCursor.match(/(?:\n|^)\/(\w*)$/);
    if (!match) return null;
    return "menu";
}

function useSlashAutocomplete(opts: {
    owner: string | undefined;
    repo: string | undefined;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    cursorRef: React.RefObject<{ start: number; end: number } | null>;
    valueRef: React.RefObject<string>;
    onChangeRef: React.RefObject<(value: string) => void>;
    disabledRef: React.RefObject<boolean>;
    savedSelectionRef: React.RefObject<{ start: number; end: number }>;
}) {
    const {
        owner,
        repo,
        textareaRef,
        cursorRef,
        valueRef,
        onChangeRef,
        disabledRef,
        savedSelectionRef,
    } = opts;

    const [autocompleteQuery, setAutocompleteQuery] = useState<string | null>(
        null,
    );
    const [autocompleteIndex, setAutocompleteIndex] = useState(0);
    const [dropdownTop, setDropdownTop] = useState(80);
    const [slashMenuView, setSlashMenuView] = useState<
        "menu" | "table-form" | "alert-form" | null
    >(null);
    const [slashMenuPos, setSlashMenuPos] = useState<React.CSSProperties>({
        top: 80,
    });
    const [alertType, setAlertType] = useState("Note");
    const slashLinePosRef = useRef<number | null>(null);

    const {
        data: autocompleteIssues = [],
        isFetching: issuesLoading,
        isError: issuesError,
        error: issuesErrorObj,
    } = api.issues.searchAutocomplete.useQuery(
        {
            owner: owner as string,
            repo: repo as string,
            query: autocompleteQuery as string,
        },
        {
            enabled: autocompleteQuery !== null && !!owner && !!repo,
            staleTime: 30_000,
            placeholderData: keepPreviousData,
        },
    );

    const dismissAutocomplete = useCallback(() => {
        setAutocompleteQuery(null);
        setAutocompleteIndex(0);
    }, []);

    // biome-ignore lint/correctness/useExhaustiveDependencies: refs are stable across renders
    const dismissSlashMenu = useCallback(() => {
        setSlashMenuView(null);
        const pos = slashLinePosRef.current;
        slashLinePosRef.current = null;
        setAlertType("Note");
        if (pos !== null) {
            cursorRef.current = { start: pos, end: pos };
        }
    }, []);

    const insertGeneratedAtSlashLine = (
        generated: { text: string; cursorPos: number },
        linePos: number,
    ) => {
        const newText =
            valueRef.current.slice(0, linePos) +
            generated.text +
            valueRef.current.slice(linePos);
        const adjustedCursor = linePos + generated.cursorPos;
        cursorRef.current = { start: adjustedCursor, end: adjustedCursor };
        onChangeRef.current(newText);
        dismissSlashMenu();
        textareaRef.current?.focus();
    };

    // biome-ignore lint/correctness/useExhaustiveDependencies: refs are stable across renders
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

            insertGeneratedAtSlashLine(generated, linePos);
        },
        [dismissSlashMenu],
    );

    // biome-ignore lint/correctness/useExhaustiveDependencies: refs are stable across renders
    const handleInsertTable = useCallback(
        (columns: number, rows: number) => {
            const linePos = slashLinePosRef.current;
            if (linePos === null) return;
            insertGeneratedAtSlashLine(generateTable(columns, rows), linePos);
        },
        [dismissSlashMenu],
    );

    // biome-ignore lint/correctness/useExhaustiveDependencies: refs are stable across renders
    const handleSelectAlertType = useCallback(
        (type: string) => {
            const linePos = slashLinePosRef.current;
            if (linePos === null) return;
            insertGeneratedAtSlashLine(generateAlert(type), linePos);
        },
        [dismissSlashMenu],
    );

    const handleSlashBackToMenu = useCallback(() => {
        setSlashMenuView("menu");
    }, []);

    // biome-ignore lint/correctness/useExhaustiveDependencies: refs are stable across renders
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

    // biome-ignore lint/correctness/useExhaustiveDependencies: refs are stable across renders
    const openSlashForm = useCallback((view: "table-form" | "alert-form") => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        slashLinePosRef.current = textarea.selectionStart;
        setSlashMenuPos({ top: 34, right: 8 });
        setSlashMenuView(view);
    }, []);

    const handleTextareaBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
        savedSelectionRef.current = {
            start: e.target.selectionStart,
            end: e.target.selectionEnd,
        };
        setTimeout(() => {
            if (document.activeElement?.closest('[data-autocomplete="true"]'))
                return;
            dismissAutocomplete();
            dismissSlashMenu();
        }, 100);
    };

    const handleTextareaChange = (
        e: React.ChangeEvent<HTMLTextAreaElement>,
    ) => {
        if (slashMenuView === "menu") {
            e.target.value = valueRef.current;
            return;
        }
        const newValue = e.target.value;
        const cursorPos = e.target.selectionStart;
        onChangeRef.current(newValue);
        if (!disabledRef.current && owner && repo) {
            const q = detectAutocomplete(newValue, cursorPos);
            setAutocompleteQuery(q);
            setAutocompleteIndex(0);
            if (q !== null) {
                const textarea = e.target;
                const lineNumber =
                    newValue.slice(0, cursorPos).split("\n").length - 1;
                const top =
                    textarea.offsetTop +
                    8 +
                    (lineNumber + 1) * 20 -
                    textarea.scrollTop;
                setDropdownTop(top);
            }
        }

        const slashResult = detectSlashCommand(newValue, cursorPos);
        if (slashResult === "menu" && slashMenuView === null) {
            const textarea = e.target;
            const lineNumber =
                newValue.slice(0, cursorPos).split("\n").length - 1;
            const top =
                textarea.offsetTop +
                8 +
                (lineNumber + 1) * 20 -
                textarea.scrollTop;
            const textBeforeCursor = newValue.slice(0, cursorPos);
            const match = textBeforeCursor.match(/(?:\n|^)\/(\w*)$/);
            if (match) {
                const slashPos =
                    (match.index ?? 0) + (match[0].startsWith("\n") ? 1 : 0);
                slashLinePosRef.current = slashPos;
                const removedSlash =
                    newValue.slice(0, slashPos) + newValue.slice(slashPos + 1);
                onChangeRef.current(removedSlash);
                cursorRef.current = {
                    start: slashPos,
                    end: slashPos,
                };
            }
            setSlashMenuPos({ top, left: 0 });
            setSlashMenuView("menu");
        } else if (slashResult === null && slashMenuView !== null) {
            dismissSlashMenu();
        }
    };

    const handleTextareaKeyUp = (
        e: React.KeyboardEvent<HTMLTextAreaElement>,
    ) => {
        if (
            autocompleteQuery !== null &&
            ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
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
            ["ArrowLeft", "ArrowRight", "Home", "End", "Backspace"].includes(
                e.key,
            )
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
    };

    const autocompleteError = issuesError
        ? (issuesErrorObj?.message ?? "Unknown error")
        : null;

    return {
        autocompleteQuery,
        autocompleteIndex,
        autocompleteIssues,
        issuesLoading,
        autocompleteError,
        dropdownTop,
        slashMenuView,
        slashMenuPos,
        alertType,
        setAutocompleteIndex,
        setAlertType,
        dismissAutocomplete,
        dismissSlashMenu,
        handleSlashMenuItemSelect,
        handleInsertTable,
        handleSelectAlertType,
        handleSlashBackToMenu,
        handleAutocompleteSelect,
        openSlashForm,
        handleTextareaChange,
        handleTextareaBlur,
        handleTextareaKeyUp,
    };
}

function useFormattingHandlers(opts: {
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    savedSelectionRef: React.RefObject<{ start: number; end: number }>;
    disabledRef: React.RefObject<boolean>;
    valueRef: React.RefObject<string>;
    onChangeRef: React.RefObject<(value: string) => void>;
    cursorRef: React.RefObject<{ start: number; end: number } | null>;
}) {
    const {
        textareaRef,
        savedSelectionRef,
        disabledRef,
        valueRef,
        onChangeRef,
        cursorRef,
    } = opts;

    // biome-ignore lint/correctness/useExhaustiveDependencies: refs are stable across renders
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

    // biome-ignore lint/correctness/useExhaustiveDependencies: refs are stable across renders
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

    return {
        handleToolbarInsert,
        handleBold,
        handleItalic,
        handleHeading,
        handleStrikethrough,
        handleCode,
        handleCodeBlock,
        handleLink,
        handleUnorderedList,
        handleOrderedList,
        handleTaskList,
        handleBlockquote,
    };
}

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

function EditorToolbar({
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

interface EditorTextareaProps {
    mode: "write" | "preview";
    value: string;
    placeholder: string;
    minHeight: string;
    autoFocus: boolean;
    disabled: boolean;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    onTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onBlur: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onKeyUp: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    owner: string | undefined;
    repo: string | undefined;
    onToggleTask: (content: string) => void;
}

function EditorTextarea({
    mode,
    value,
    placeholder,
    minHeight,
    autoFocus,
    disabled,
    textareaRef,
    onTextChange,
    onBlur,
    onKeyDown,
    onKeyUp,
    owner,
    repo,
    onToggleTask,
}: EditorTextareaProps) {
    if (mode === "write") {
        return (
            <textarea
                autoFocus={autoFocus}
                className="w-full resize-y border-0 bg-surface px-3 py-2 text-sm text-text-primary placeholder-gray-400 focus:outline-none focus:ring-0 disabled:bg-gray-50 dark:placeholder-zinc-500 dark:disabled:bg-zinc-800"
                disabled={disabled}
                onBlur={onBlur}
                onChange={onTextChange}
                onKeyDown={onKeyDown}
                onKeyUp={onKeyUp}
                placeholder={placeholder}
                ref={textareaRef}
                style={{ minHeight }}
                value={value}
            />
        );
    }
    return (
        <div className="max-w-none bg-surface px-3 py-2" style={{ minHeight }}>
            <MarkdownRenderer
                content={value}
                owner={owner}
                repo={repo}
                onToggleTask={onToggleTask}
            />
        </div>
    );
}

interface EditorFooterProps {
    onCancel?: () => void;
    cancelLabel: string;
    disabled: boolean;
    footerActions?: FooterAction[];
    value: string;
}

function EditorFooter({
    onCancel,
    cancelLabel,
    disabled,
    footerActions,
    value,
}: EditorFooterProps) {
    if (!footerActions && !onCancel) return null;
    return (
        <div className="flex items-center justify-between gap-2 border-gray-300 border-t bg-surface-secondary px-3 py-2 dark:border-zinc-600">
            {onCancel ? (
                <button
                    className="cursor-pointer rounded-md border border-gray-300 px-4 py-1.5 font-medium text-sm text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
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
                    {footerActions.map((action) => {
                        const actionDisabled =
                            disabled ||
                            (typeof action.disabled === "function"
                                ? action.disabled(value)
                                : action.disabled);

                        const button = (
                            <button
                                className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-4 py-1.5 font-medium text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                    action.variant === "approve"
                                        ? "bg-[#2da44e] text-white enabled:hover:bg-[#218838]"
                                        : action.variant === "danger"
                                          ? "bg-[#cf222e] text-white enabled:hover:bg-[#b91c23]"
                                          : action.variant === "outline"
                                            ? "bg-surface-elevated text-text-label ring-1 ring-ring enabled:hover:bg-gray-50 dark:enabled:hover:bg-zinc-700"
                                            : "bg-neutral-200 text-black enabled:hover:bg-neutral-300"
                                }`}
                                disabled={actionDisabled}
                                onClick={action.onClick}
                                type="button"
                            >
                                {action.icon}
                                {action.label}
                            </button>
                        );

                        if (!action.tooltip) {
                            return (
                                <Fragment key={action.label}>{button}</Fragment>
                            );
                        }

                        return (
                            <Tooltip key={action.label}>
                                <TooltipTrigger asChild>
                                    <span className="inline-flex">
                                        {button}
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    {action.tooltip}
                                </TooltipContent>
                            </Tooltip>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

interface EditorPopoversProps {
    mode: "write" | "preview";
    autocompleteQuery: string | null;
    owner: string | undefined;
    repo: string | undefined;
    autocompleteIssues: IssueItem[];
    issuesLoading: boolean;
    autocompleteError: string | null;
    autocompleteIndex: number;
    onAutocompleteSelect: (issueNumber: number) => void;
    dropdownTop: number;
    slashMenuView: "menu" | "table-form" | "alert-form" | null;
    slashMenuPos: React.CSSProperties;
    onCommandSelect: (itemId: string) => void;
    onInsertTable: (columns: number, rows: number) => void;
    selectedAlertType: string;
    onSelectAlertType: (type: string) => void;
    onBackToMenu: () => void;
    onClose: () => void;
}

function EditorPopovers({
    mode,
    autocompleteQuery,
    owner,
    repo,
    autocompleteIssues,
    issuesLoading,
    autocompleteError,
    autocompleteIndex,
    onAutocompleteSelect,
    dropdownTop,
    slashMenuView,
    slashMenuPos,
    onCommandSelect,
    onInsertTable,
    selectedAlertType,
    onSelectAlertType,
    onBackToMenu,
    onClose,
}: EditorPopoversProps) {
    if (mode !== "write") return null;
    return (
        <>
            {mode === "write" &&
                autocompleteQuery !== null &&
                owner &&
                repo &&
                !issuesLoading &&
                autocompleteIssues.length > 0 && (
                    <IssueAutocomplete
                        issues={autocompleteIssues}
                        loading={issuesLoading}
                        error={autocompleteError}
                        selectedIndex={autocompleteIndex}
                        onSelect={onAutocompleteSelect}
                        style={{ top: dropdownTop }}
                    />
                )}
            {mode === "write" && slashMenuView !== null && (
                <SlashCommandMenu
                    style={slashMenuPos}
                    view={slashMenuView}
                    onCommandSelect={onCommandSelect}
                    onInsertTable={onInsertTable}
                    selectedAlertType={selectedAlertType}
                    onSelectAlertType={onSelectAlertType}
                    onBackToMenu={onBackToMenu}
                    onClose={onClose}
                />
            )}{" "}
        </>
    );
}
