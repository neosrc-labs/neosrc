"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DiffCommentTarget, DiffSide } from "./types";
import type { DiffSelectedRange } from "./use-diff-line-selection";

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
    onOrdinaryLineMouseDown: (line: number, side: string) => void;
    onOrdinaryTableMouseOver: (event: React.MouseEvent) => void;
}) {
    const [commentDragRange, setCommentDragRange] = useState<{
        startLine: number;
        endLine: number;
        side: DiffSide;
    } | null>(null);
    const commentDragAnchor = useRef<{ line: number; side: DiffSide } | null>(
        null,
    );
    const commentDragInProgress = useRef(false);

    const onCommentDragStart = useCallback(
        (line: number, side: DiffSide) => {
            commentDragInProgress.current = true;
            commentDragAnchor.current = { line, side };
            setCommentDragRange({ startLine: line, endLine: line, side });
            onSelectionChange({ startLine: line, endLine: line, side });
        },
        [onSelectionChange],
    );

    const onCommentLineMouseDown = useCallback(
        (line: number, side: string) => {
            if (activeComment?.type === "line" && activeComment.side === side) {
                const diffSide = side as DiffSide;
                commentDragInProgress.current = true;
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
            onOrdinaryLineMouseDown(line, side);
        },
        [activeComment, onOrdinaryLineMouseDown],
    );

    const onCommentTableMouseOver = useCallback(
        (event: React.MouseEvent) => {
            if (!commentDragInProgress.current || !commentDragAnchor.current) {
                onOrdinaryTableMouseOver(event);
                return;
            }
            const row = (event.target as HTMLElement).closest(
                'tr[id^="diff-"]',
            );
            const lineMatch = row?.id.match(/(\d+)$/);
            if (!lineMatch) return;
            const line = Number.parseInt(lineMatch[1] ?? "0", 10);
            const anchor = commentDragAnchor.current;
            const startLine = Math.min(anchor.line, line);
            const endLine = Math.max(anchor.line, line);
            setCommentDragRange({ startLine, endLine, side: anchor.side });
            onSelectionChange({ startLine, endLine, side: anchor.side });
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
