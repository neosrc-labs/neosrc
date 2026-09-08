"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

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

/**
 * Bounds, in both number spaces, of the rendered rows running from the row
 * holding `anchorLine` on `side` through `row`.
 *
 * The two endpoint rows alone cannot bracket every row they span: an
 * insertion carries no old line and a deletion no new line, so a range
 * anchored on the old side leaves insertions inside it unbracketed. Both
 * number spaces increase monotonically down the rows, so the bounding box of
 * the rows actually walked is exactly the run and covers its unpaired rows.
 * Returns null when the anchor row is not reachable from `row`, leaving the
 * caller with its endpoint-only bounds.
 */
export function collectRunBounds(
    row: HTMLElement | null | undefined,
    side: string,
    anchorLine: number,
): { startLines: DiffRowLines; endLines: DiffRowLines } | null {
    if (!row) return null;
    const from = readRowLine(row, side);
    if (from == null) return null;
    // Walk toward the anchor row: down when it sits below the hovered row.
    const down = from < anchorLine;
    let oldMin: number | undefined;
    let oldMax: number | undefined;
    let newMin: number | undefined;
    let newMax: number | undefined;
    let current: Element | null = row;
    while (current) {
        const element = current as HTMLElement;
        const oldLine = readRowLine(element, "LEFT");
        if (oldLine != null) {
            oldMin = oldMin == null ? oldLine : Math.min(oldMin, oldLine);
            oldMax = oldMax == null ? oldLine : Math.max(oldMax, oldLine);
        }
        const newLine = readRowLine(element, "RIGHT");
        if (newLine != null) {
            newMin = newMin == null ? newLine : Math.min(newMin, newLine);
            newMax = newMax == null ? newLine : Math.max(newMax, newLine);
        }
        if (readRowLine(element, side) === anchorLine) {
            return {
                startLines: { oldLine: oldMin, newLine: newMin },
                endLines: { oldLine: oldMax, newLine: newMax },
            };
        }
        current = down
            ? current.nextElementSibling
            : current.previousElementSibling;
    }
    return null;
}

/**
 * The rendered row for a (line, side) anchor. Split view puts the old-side id
 * on the line-number cell rather than the row, so resolve to the row.
 */
export function findRowElement(
    fileHash: string,
    line: number,
    side: string,
): HTMLElement | null {
    const sideCode = side === "RIGHT" ? "R" : "L";
    const element = document.getElementById(
        `diff-${fileHash}${sideCode}${line}`,
    );
    return element?.closest("tr") ?? null;
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
 * space (unpaired additions/deletions missing one side still count through
 * the side they have). Hash-loaded ranges fall back to the range
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

// Line selection is global: the page shows one selected range at a time, in
// one file, matching the single #diff-<hash><side><line> permalink the URL
// carries. Each file's DiffView owns its own state otherwise, so the range
// lives in a module store keyed by file instead. Listeners are per file so a
// selection change only re-renders the file losing it and the file gaining
// it, not every mounted diff.
let currentSelection: { fileHash: string; range: DiffSelectedRange } | null =
    null;
const selectionListeners = new Map<string, Set<() => void>>();

function readSelection(fileHash: string): DiffSelectedRange | null {
    return currentSelection?.fileHash === fileHash
        ? currentSelection.range
        : null;
}

function notifySelection(fileHash: string) {
    const listeners = selectionListeners.get(fileHash);
    if (!listeners) return;
    for (const listener of listeners) listener();
}

function writeSelection(fileHash: string, range: DiffSelectedRange | null) {
    const previous = currentSelection;
    if (previous === null && range === null) return;
    currentSelection = range === null ? null : { fileHash, range };
    if (previous && previous.fileHash !== fileHash) {
        notifySelection(previous.fileHash);
    }
    notifySelection(fileHash);
}

/** Drops the global selection; for tests, which share the module state. */
export function resetDiffLineSelection() {
    currentSelection = null;
    selectionListeners.clear();
}

export function useDiffLineSelection(fileHash: string) {
    const subscribe = useCallback(
        (listener: () => void) => {
            const listeners =
                selectionListeners.get(fileHash) ?? new Set<() => void>();
            listeners.add(listener);
            selectionListeners.set(fileHash, listeners);
            return () => {
                listeners.delete(listener);
                if (
                    listeners.size === 0 &&
                    selectionListeners.get(fileHash) === listeners
                ) {
                    selectionListeners.delete(fileHash);
                }
            };
        },
        [fileHash],
    );
    const selectedRange = useSyncExternalStore(
        subscribe,
        () => readSelection(fileHash),
        () => null,
    );
    const setSelectedRange = useCallback(
        (action: React.SetStateAction<DiffSelectedRange | null>): void =>
            writeSelection(
                fileHash,
                typeof action === "function"
                    ? action(readSelection(fileHash))
                    : action,
            ),
        [fileHash],
    );
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
        [setSelectedRange],
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
                const bounds = collectRunBounds(
                    findRowElement(fileHash, line, side),
                    anchor.side,
                    anchor.line,
                );
                commitRangeUrl(anchor.line, targetLine, anchor.side);
                updateSelection(
                    anchor.line,
                    targetLine,
                    anchor.side,
                    bounds?.startLines ?? anchor.lines,
                    bounds?.endLines ?? rowLines,
                );
                mouseAnchorRef.current = null;
                return;
            }
            commitSingleUrl(line, side);
            updateSelection(line, line, side, rowLines, rowLines);
            mouseAnchorRef.current = { line, side, lines: rowLines };
        },
        [commitRangeUrl, commitSingleUrl, fileHash, updateSelection],
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
            const bounds = collectRunBounds(row, anchor.side, anchor.line);
            updateSelection(
                anchor.line,
                line,
                anchor.side,
                bounds?.startLines ?? anchor.lines,
                bounds?.endLines ?? {
                    oldLine: readRowLine(row, "LEFT") ?? undefined,
                    newLine: readRowLine(row, "RIGHT") ?? undefined,
                },
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
    }, [selectedRange, setSelectedRange]);

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
