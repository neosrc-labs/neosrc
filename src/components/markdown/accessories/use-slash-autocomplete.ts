"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { api } from "~/trpc/react";
import {
    generateAlert,
    generateCodeBlock,
    generateDetails,
    generateTable,
    generateTaskList,
} from "./markdown-utils";

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

export function useSlashAutocomplete(opts: {
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
