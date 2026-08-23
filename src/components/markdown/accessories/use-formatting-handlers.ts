"use client";

import { useCallback } from "react";
import {
    applyCodeBlockFormat,
    applyInlineFormat,
    applyListFormat,
    findLineStart,
} from "./markdown-utils";

export function useFormattingHandlers(opts: {
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
