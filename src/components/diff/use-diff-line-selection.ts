"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface DiffSelectedRange {
    startLine: number;
    endLine: number;
    side: string;
}

export function useDiffLineSelection(fileHash: string) {
    const [selectedRange, setSelectedRange] =
        useState<DiffSelectedRange | null>(null);
    const mouseAnchorRef = useRef<{ line: number; side: string } | null>(null);
    const isDragging = useRef(false);
    const dragStartRef = useRef<{ line: number; side: string } | null>(null);

    const updateSelection = useCallback(
        (startLine: number, endLine: number, side: string) => {
            setSelectedRange({
                startLine: Math.min(startLine, endLine),
                endLine: Math.max(startLine, endLine),
                side,
            });
        },
        [],
    );

    const commitRangeUrl = useCallback(
        (startLine: number, endLine: number, side: string) => {
            const lo = Math.min(startLine, endLine);
            const hi = Math.max(startLine, endLine);
            const sideCode = side === "RIGHT" ? "R" : "L";
            history.replaceState(
                null,
                "",
                `${window.location.pathname}#diff-${fileHash}${sideCode}${lo}-${sideCode}${hi}`,
            );
        },
        [fileHash],
    );

    const commitSingleUrl = useCallback(
        (line: number, side: string) => {
            const sideCode = side === "RIGHT" ? "R" : "L";
            history.replaceState(
                null,
                "",
                `${window.location.pathname}#diff-${fileHash}${sideCode}${line}`,
            );
        },
        [fileHash],
    );

    const onLineSelect = useCallback(
        (line: number, side: string, shiftKey: boolean) => {
            if (shiftKey && mouseAnchorRef.current) {
                const start = Math.min(mouseAnchorRef.current.line, line);
                const end = Math.max(mouseAnchorRef.current.line, line);
                commitRangeUrl(start, end, side);
                updateSelection(start, end, side);
                mouseAnchorRef.current = null;
                return;
            }
            commitSingleUrl(line, side);
            updateSelection(line, line, side);
            mouseAnchorRef.current = { line, side };
        },
        [commitRangeUrl, commitSingleUrl, updateSelection],
    );

    const onLineMouseDown = useCallback(
        (line: number, side: string) => {
            isDragging.current = true;
            dragStartRef.current = { line, side };
            updateSelection(line, line, side);
        },
        [updateSelection],
    );

    const onTableMouseOver = useCallback(
        (event: React.MouseEvent) => {
            if (!isDragging.current || !dragStartRef.current) return;
            const row = (event.target as HTMLElement).closest(
                'tr[id^="diff-"]',
            );
            const lineMatch = row?.id.match(/(\d+)$/);
            if (!lineMatch) return;
            const line = Number.parseInt(lineMatch[1] ?? "0", 10);
            updateSelection(
                dragStartRef.current.line,
                line,
                dragStartRef.current.side,
            );
        },
        [updateSelection],
    );

    useEffect(() => {
        const onDocumentMouseUp = () => {
            if (!isDragging.current || !dragStartRef.current) return;
            const anchor = dragStartRef.current;
            isDragging.current = false;
            if (
                selectedRange &&
                selectedRange.startLine !== selectedRange.endLine
            ) {
                commitRangeUrl(
                    selectedRange.startLine,
                    selectedRange.endLine,
                    selectedRange.side,
                );
            } else {
                commitSingleUrl(anchor.line, anchor.side);
            }
            dragStartRef.current = null;
        };
        document.addEventListener("mouseup", onDocumentMouseUp);
        return () => document.removeEventListener("mouseup", onDocumentMouseUp);
    }, [commitRangeUrl, commitSingleUrl, selectedRange]);

    return {
        selectedRange,
        onLineSelect,
        onLineMouseDown,
        onTableMouseOver,
        setSelectedRange,
        updateSelection,
    };
}
