"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DiffCommentTarget, DiffSide } from "./types";
import {
    type DiffRowLines,
    type DiffSelectedRange,
    readRowLine,
} from "./use-diff-line-selection";

export function useDiffCommentSelection({
    activeComment,
    onStartComment,
    selectedRange,
    onSelectionChange,
    onOrdinaryLineMouseDown,
    onOrdinaryTableMouseOver,
}: {
    activeComment: DiffCommentTarget | null;
    onStartComment?: (target: DiffCommentTarget | null) => void;
    selectedRange: DiffSelectedRange | null;
    onSelectionChange: (range: DiffSelectedRange) => void;
    onOrdinaryLineMouseDown: (
        line: number,
        side: string,
        lines?: DiffRowLines,
    ) => void;
    onOrdinaryTableMouseOver: (event: React.MouseEvent) => void;
}) {
    const [commentDragRange, setCommentDragRange] = useState<{
        startLine: number;
        endLine: number;
        side: DiffSide;
    } | null>(null);
    const commentDragAnchor = useRef<{
        line: number;
        side: DiffSide;
        lines?: DiffRowLines;
    } | null>(null);
    const commentDragInProgress = useRef(false);

    const onCommentDragStart = useCallback(
        (line: number, side: DiffSide, lines?: DiffRowLines) => {
            commentDragInProgress.current = true;
            commentDragAnchor.current = { line, side, lines };
            setCommentDragRange({ startLine: line, endLine: line, side });
            onSelectionChange({
                startLine: line,
                endLine: line,
                side,
                startLines: lines,
                endLines: lines,
            });
        },
        [onSelectionChange],
    );

    const onCommentLineMouseDown = useCallback(
        (line: number, side: string, _lines?: DiffRowLines) => {
            if (activeComment?.type === "line" && activeComment.side === side) {
                const diffSide = side as DiffSide;
                commentDragInProgress.current = true;
                // The anchor is the active comment's row: `line` is
                // activeComment.line, but the pointer row's `lines` can
                // belong to a different row inside the comment range. Omit
                // them — the side-flip path must not read another row's
                // opposite-side number as the anchor's.
                commentDragAnchor.current = {
                    line: activeComment.line,
                    side: diffSide,
                };
                setCommentDragRange({
                    startLine: Math.min(activeComment.line, line),
                    endLine: Math.max(activeComment.line, line),
                    side: diffSide,
                });
                return;
            }
            onOrdinaryLineMouseDown(line, side, _lines);
        },
        [activeComment, onOrdinaryLineMouseDown],
    );

    const onCommentTableMouseOver = useCallback(
        (event: React.MouseEvent) => {
            if (!commentDragInProgress.current || !commentDragAnchor.current) {
                onOrdinaryTableMouseOver(event);
                return;
            }
            const anchor = commentDragAnchor.current;
            const row = (event.target as HTMLElement).closest(
                'tr[id^="diff-"]',
            ) as HTMLElement | null;
            // Extend along the anchor side's number space (see
            // useDiffLineSelection): old and new line numbers can diverge
            // across regions.
            let side = anchor.side;
            let anchorLine = anchor.line;
            let line = readRowLine(row, side);
            if (line == null) {
                // The hovered row has no line on the anchor side (e.g. a
                // deletion in a range anchored on the new side). When the
                // anchor row also has a line on the row's side, flip the
                // range to that side so the comment can still span both
                // regions instead of stopping at the last matching row.
                const otherSide = side === "LEFT" ? "RIGHT" : "LEFT";
                const anchorOther =
                    otherSide === "LEFT"
                        ? anchor.lines?.oldLine
                        : anchor.lines?.newLine;
                const rowOther = readRowLine(row, otherSide);
                if (anchorOther == null || rowOther == null) return;
                side = otherSide;
                anchorLine = anchorOther;
                line = rowOther;
                commentDragAnchor.current = {
                    line: anchorLine,
                    side,
                    lines: anchor.lines,
                };
            }
            const rowLines = {
                oldLine: readRowLine(row, "LEFT") ?? undefined,
                newLine: readRowLine(row, "RIGHT") ?? undefined,
            };
            const startLine = Math.min(anchorLine, line);
            const endLine = Math.max(anchorLine, line);
            setCommentDragRange({ startLine, endLine, side });
            onSelectionChange({
                startLine,
                endLine,
                side,
                startLines: anchor.lines,
                endLines: rowLines,
            });
        },
        [onOrdinaryTableMouseOver, onSelectionChange],
    );

    const onDocumentMouseUp = useCallback(() => {
        if (!commentDragInProgress.current) return;
        commentDragInProgress.current = false;
        const range = commentDragRange;
        if (range && range.startLine !== range.endLine) {
            onStartComment?.({
                type: "line",
                line: range.endLine,
                side: range.side,
                startLine: range.startLine,
                startSide: range.side,
            });
        }
        commentDragAnchor.current = null;
        setCommentDragRange(null);
    }, [commentDragRange, onStartComment]);

    useEffect(() => {
        document.addEventListener("mouseup", onDocumentMouseUp);
        return () => document.removeEventListener("mouseup", onDocumentMouseUp);
    }, [onDocumentMouseUp]);

    return {
        commentDragRange,
        onCommentDragStart,
        onCommentLineMouseDown,
        onCommentTableMouseOver,
        onDocumentMouseUp,
        selectedRange,
    };
}
