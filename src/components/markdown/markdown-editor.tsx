"use client";

import {
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { handleEnterKey } from "./accessories/markdown-utils";
import { useFormattingHandlers } from "./accessories/use-formatting-handlers";
import { useSlashAutocomplete } from "./accessories/use-slash-autocomplete";
import { EditorFooter } from "./editor-footer";
import { EditorPopovers } from "./editor-popovers";
import { EditorToolbar } from "./editor-toolbar";
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
