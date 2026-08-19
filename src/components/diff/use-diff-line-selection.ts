"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface DiffSelectedRange {
    startLine: number;
    endLine: number;
    side: string;
    /** Both-side lines of the range's endpoint rows, when known. */
    startLines?: DiffRowLines;
    endLines?: DiffRowLines;
}

/** The line numbers a row exposes on each side; a side may be missing. */
export interface DiffRowLines {
    oldLine?: number;
    newLine?: number;
}

/** Read the number for `side` off a rendered row (set via data attributes). */
export function readRowLine(
    row: HTMLElement | null | undefined,
    side: string,
): number | null {
    const raw = row?.dataset[side === "RIGHT" ? "newLine" : "oldLine"];
    if (!raw) return null;
    const line = Number.parseInt(raw, 10);
    return Number.isFinite(line) ? line : null;
}

function isBetween(
    value: number,
    a: number | undefined,
    b: number | undefined,
): boolean {
    return (
        a != null &&
        b != null &&
        value >= Math.min(a, b) &&
        value <= Math.max(a, b)
    );
}

/**
 * Whether a row is covered by the current selection. Interactive selections
 * carry the endpoint rows' lines on both sides, so coverage is a sweep over
 * rows: a row counts when it sits between the endpoints in either number
 * space (rows missing one side — unpaired additions/deletions — still count
 * through the side they have). Hash-loaded ranges fall back to the range
 * side's number space.
 */
export function isRowSelected(
    range: DiffSelectedRange | null | undefined,
    oldLine: number | undefined,
    newLine: number | undefined,
): boolean {
    if (!range) return false;
    const { startLine, endLine, side, startLines, endLines } = range;
    if (startLines != null && endLines != null) {
        return (
            (oldLine != null &&
                isBetween(oldLine, startLines.oldLine, endLines.oldLine)) ||
            (newLine != null &&
                isBetween(newLine, startLines.newLine, endLines.newLine))
        );
    }
    const lo = Math.min(startLine, endLine);
    const hi = Math.max(startLine, endLine);
    return side === "LEFT"
        ? oldLine != null && oldLine >= lo && oldLine <= hi
        : newLine != null && newLine >= lo && newLine <= hi;
}

export function useDiffLineSelection(fileHash: string) {
    const [selectedRange, setSelectedRange] =
        useState<DiffSelectedRange | null>(null);
    const mouseAnchorRef = useRef<{
        line: number;
        side: string;
        lines?: DiffRowLines;
    } | null>(null);
    const isDragging = useRef(false);
    const dragStartRef = useRef<{
        line: number;
        side: string;
        lines?: DiffRowLines;
    } | null>(null);

    const updateSelection = useCallback(
        (
            startLine: number,
            endLine: number,
            side: string,
            startLines?: DiffRowLines,
            endLines?: DiffRowLines,
        ) => {
            setSelectedRange({
                startLine: Math.min(startLine, endLine),
                endLine: Math.max(startLine, endLine),
                side,
                startLines,
                endLines,
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
        (
            line: number,
            side: string,
            shiftKey: boolean,
            rowLines?: DiffRowLines,
        ) => {
            if (shiftKey && mouseAnchorRef.current) {
                const anchor = mouseAnchorRef.current;
                // A range lives in one number space (the anchor side's).
                // When the clicked cell belongs to the other side, use the
                // clicked row's number on the anchor side instead.
                const targetLine =
                    side === anchor.side
                        ? line
                        : anchor.side === "RIGHT"
                          ? rowLines?.newLine
                          : rowLines?.oldLine;
                if (targetLine == null) {
                    // The clicked row has no line on the anchor side; start
                    // a fresh selection on the clicked side.
                    commitSingleUrl(line, side);
                    updateSelection(line, line, side, rowLines, rowLines);
                    mouseAnchorRef.current = { line, side, lines: rowLines };
                    return;
                }
                commitRangeUrl(anchor.line, targetLine, anchor.side);
                updateSelection(
                    anchor.line,
                    targetLine,
                    anchor.side,
                    anchor.lines,
                    rowLines,
                );
                mouseAnchorRef.current = null;
                return;
            }
            commitSingleUrl(line, side);
            updateSelection(line, line, side, rowLines, rowLines);
            mouseAnchorRef.current = { line, side, lines: rowLines };
        },
        [commitRangeUrl, commitSingleUrl, updateSelection],
    );

    const onLineMouseDown = useCallback(
        (line: number, side: string, rowLines?: DiffRowLines) => {
            isDragging.current = true;
            dragStartRef.current = { line, side, lines: rowLines };
            updateSelection(line, line, side, rowLines, rowLines);
        },
        [updateSelection],
    );

    const onTableMouseOver = useCallback(
        (event: React.MouseEvent) => {
            if (!isDragging.current || !dragStartRef.current) return;
            const anchor = dragStartRef.current;
            const row = (event.target as HTMLElement).closest(
                'tr[id^="diff-"]',
            ) as HTMLElement | null;
            // Extend along the anchor side's number space so ranges stay
            // consistent even when old and new line numbers diverge (regions
            // separated by gaps, additions vs deletions).
            const line = readRowLine(row, anchor.side);
            if (line == null) return;
            const rowLines = {
                oldLine: readRowLine(row, "LEFT") ?? undefined,
                newLine: readRowLine(row, "RIGHT") ?? undefined,
            };
            updateSelection(
                anchor.line,
                line,
                anchor.side,
                anchor.lines,
                rowLines,
            );
        },
        [updateSelection],
    );

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && selectedRange) {
                e.preventDefault();
                setSelectedRange(null);
                history.replaceState(null, "", window.location.pathname);
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [selectedRange]);

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
