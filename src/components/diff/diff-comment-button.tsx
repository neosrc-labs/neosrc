"use client";

import { Plus } from "lucide-react";
import type { DiffCommentTarget, DiffSide } from "./types";
import type { DiffRowLines } from "./use-diff-line-selection";

interface DiffCommentButtonProps {
    line: number;
    side: DiffSide;
    rowLines?: DiffRowLines;
    isActive: boolean;
    activeComment: DiffCommentTarget | null;
    onStartComment: (target: DiffCommentTarget | null) => void;
    onDragStart?: (line: number, side: DiffSide, lines?: DiffRowLines) => void;
    visibilityClass: string;
}

export function DiffCommentButton({
    line,
    side,
    rowLines,
    isActive,
    activeComment,
    onStartComment,
    onDragStart,
    visibilityClass,
}: DiffCommentButtonProps) {
    return (
        <Plus
            size={24}
            className={`absolute -right-3.5 z-10 ${visibilityClass} rounded-md bg-action p-0.5 text-action-foreground`}
            onMouseDown={(event) => {
                event.stopPropagation();
                onDragStart?.(line, side, rowLines);
            }}
            onClick={(event) => {
                event.stopPropagation();
                if (
                    event.shiftKey &&
                    activeComment?.type === "line" &&
                    activeComment.side === side
                ) {
                    onStartComment({
                        type: "line",
                        line: Math.max(activeComment.line, line),
                        side,
                        startLine: Math.min(activeComment.line, line),
                        startSide: side,
                    });
                    return;
                }
                onStartComment(isActive ? null : { type: "line", line, side });
            }}
        />
    );
}
