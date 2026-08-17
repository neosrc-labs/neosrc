"use client";

import { Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { PullRequestPermissionContext } from "~/app/gh/[owner]/[repo]/pull/[number]/permissions-utils";
import type { ReviewComment } from "~/server/github";
import type { DiffViewMode } from "~/utils/diff-view";
import { InlineCommentThread } from "../inline-comment-thread";
import { groupReviewCommentThreads } from "../review-comment-threads";
import { DiffLineCommentEditor } from "./diff-line-comment-editor";
import { isLastLineOfRange } from "./model";
import type { DiffAnchor, DiffRowCommentProps } from "./types";
import { isRowSelected } from "./use-diff-line-selection";

export function DiffContextRow({
    lineNum,
    oldLine,
    content,
    id,
    selectedRange,
    onLineSelect,
    onLineMouseDown,
    view = "unified",
    fileHash,
    owner,
    repo,
    commentsByLine = new Map(),
    positionMap = new Map(),
    multiLineRanges = new Map(),
    commentProps,
}: {
    lineNum: number;
    /**
     * Old-file number of the line. Gap lines are context lines, so they exist
     * on both sides; the old number can differ from the new one when changes
     * appear above the gap. Defaults to lineNum for plain context rows.
     */
    oldLine?: number;
    content: string;
    id?: string;
    selectedRange?: {
        startLine: number;
        endLine: number;
        side: string;
    } | null;
    onLineSelect?: (
        line: number,
        side: "LEFT" | "RIGHT",
        shiftKey: boolean,
        rowLines?: { oldLine?: number; newLine?: number },
    ) => void;
    onLineMouseDown?: (
        line: number,
        side: "LEFT" | "RIGHT",
        rowLines?: { oldLine?: number; newLine?: number },
    ) => void;
    view?: DiffViewMode;
    fileHash?: string;
    owner?: string;
    repo?: string;
    commentsByLine?: Map<string, ReviewComment[]>;
    positionMap?: Map<number, DiffAnchor>;
    multiLineRanges?: Map<string, string[]>;
    commentProps?: DiffRowCommentProps;
}) {
    // Lines revealed by gap expansion are context lines: they exist on both
    // sides, and comments anchor to the new side like other context lines.
    // The split view shows one button per side, so each row tracks which side
    // the pointer is over.
    const [hovered, setHovered] = useState<"LEFT" | "RIGHT" | null>(null);

    const {
        activeComment,
        onStartComment,
        pullNumber,
        commentBody,
        onCommentBodyChange,
        footerActions,
        commentPending,
        commentError,
        onCancelComment,
        showComments,
        showCommentButton,
        commentDragRange,
        onCommentDragStart,
        pendingReviewId,
        permissionContext,
    } = commentProps ?? {};

    const commentLine = lineNum;
    const oldLineNum = oldLine ?? lineNum;
    const commentSide: "LEFT" | "RIGHT" = "RIGHT";
    const lineComments =
        commentsByLine.get(`${commentLine}-${commentSide}`) ?? [];
    const isActive =
        activeComment?.type === "line" &&
        activeComment.line === commentLine &&
        activeComment.side === commentSide;
    const isInActiveRange =
        (activeComment?.type === "line" &&
            activeComment.startLine != null &&
            activeComment.side === commentSide &&
            commentLine >= activeComment.startLine &&
            commentLine <= activeComment.line) ||
        (commentDragRange != null &&
            commentDragRange.side === commentSide &&
            commentLine >= commentDragRange.startLine &&
            commentLine <= commentDragRange.endLine);
    const hasMultiLineRange =
        (multiLineRanges.get(`${commentLine}-${commentSide}`)?.length ?? 0) > 0;
    const showRangeIndicator = isInActiveRange || hasMultiLineRange;

    // Gap lines are context lines present on both sides: a covered row
    // highlights both halves in split view, the whole row in unified view.
    const rowSelected = isRowSelected(selectedRange, lineNum, lineNum);

    const renderPlusButton = (side: "LEFT" | "RIGHT") => {
        const visibilityClass =
            view === "split"
                ? hovered === side
                    ? "block"
                    : "hidden"
                : "hidden group-hover:block";
        return (
            <Plus
                size={24}
                className={`absolute -right-5 z-10 ${visibilityClass} rounded-md bg-blue-500 p-0.5 text-white`}
                onMouseDown={(e) => {
                    e.stopPropagation();
                    onCommentDragStart?.(commentLine, commentSide, {
                        oldLine: oldLineNum,
                        newLine: lineNum,
                    });
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    if (
                        e.shiftKey &&
                        activeComment?.type === "line" &&
                        activeComment.side === commentSide
                    ) {
                        const start = Math.min(activeComment.line, commentLine);
                        const end = Math.max(activeComment.line, commentLine);
                        onStartComment?.({
                            type: "line",
                            line: end,
                            side: commentSide,
                            startLine: start,
                            startSide: commentSide,
                        });
                    } else {
                        onStartComment?.(
                            isActive
                                ? null
                                : {
                                      type: "line",
                                      line: commentLine,
                                      side: commentSide,
                                  },
                        );
                    }
                }}
            />
        );
    };

    const threads = showComments
        ? groupReviewCommentThreads(lineComments).filter((thread) =>
              isLastLineOfRange(thread.parent, positionMap, commentLine),
          )
        : [];

    // Context-line comments anchor to the new side (like unified view), so
    // in split view they align with the new code column (the new line-number
    // column carries the line's lighter shade); in unified view the line
    // numbers are an absolute overlay, so the thread reserves an 8em
    // line-number cell with the same lighter shade.
    const threadCells = (children: ReactNode) =>
        view === "split" ? (
            <>
                <td className="d2h-empty-side" />
                <td className="d2h-empty-side" />
                <td className="d2h-split-ln d2h-cntx" />
                <td className="p-0 pl-[0.75em] dark:bg-zinc-950">{children}</td>
            </>
        ) : (
            <>
                <td className="d2h-thread-ln d2h-cntx" />
                <td className="p-0 dark:bg-zinc-950">{children}</td>
            </>
        );
    const editorCells = (children: ReactNode) =>
        view === "split" ? (
            <>
                <td className="d2h-empty-side" />
                <td className="d2h-empty-side" />
                <td className="d2h-split-ln d2h-cntx" />
                <td className="border-border border-t p-0">{children}</td>
            </>
        ) : (
            <>
                <td className="d2h-thread-ln d2h-cntx" />
                <td className="border-border border-t p-0">{children}</td>
            </>
        );

    const attachments = (
        <>
            {threads.map((thread) => (
                <tr key={`thread-${thread.parent.id}`}>
                    {threadCells(
                        <InlineCommentThread
                            parentComment={thread.parent}
                            replies={thread.replies}
                            owner={owner as string}
                            repo={repo as string}
                            number={Number(pullNumber ?? 0)}
                            pendingReviewId={pendingReviewId}
                            permissionContext={
                                permissionContext as PullRequestPermissionContext
                            }
                        />,
                    )}
                </tr>
            ))}
            {isActive && (
                <tr>
                    {editorCells(
                        <DiffLineCommentEditor
                            value={commentBody ?? ""}
                            onChange={onCommentBodyChange ?? (() => {})}
                            onCancel={onCancelComment ?? (() => {})}
                            footerActions={footerActions}
                            isPending={commentPending ?? false}
                            isError={commentError ?? false}
                            owner={owner as string}
                            repo={repo as string}
                        />,
                    )}
                </tr>
            )}
        </>
    );

    if (view === "split") {
        const oldSideId =
            fileHash != null ? `diff-${fileHash}L${oldLineNum}` : undefined;

        return (
            <>
                <tr
                    data-new-line={lineNum}
                    data-old-line={oldLineNum}
                    id={id}
                    onMouseLeave={() => setHovered(null)}
                >
                    <td
                        className={`d2h-code-linenumber d2h-split-ln d2h-cntx ${
                            showRangeIndicator
                                ? "border-blue-400 border-l-4"
                                : ""
                        } ${rowSelected ? "d2h-split-selected" : ""}`}
                        id={oldSideId}
                        onMouseDown={() =>
                            onLineMouseDown?.(oldLineNum, "LEFT", {
                                oldLine: oldLineNum,
                                newLine: lineNum,
                            })
                        }
                        onMouseEnter={() => setHovered("LEFT")}
                        onClick={(event) =>
                            onLineSelect?.(oldLineNum, "LEFT", event.shiftKey, {
                                oldLine: oldLineNum,
                                newLine: lineNum,
                            })
                        }
                        title="Copy permalink"
                    >
                        <div className="absolute inset-0">
                            {showCommentButton &&
                                onStartComment &&
                                renderPlusButton("LEFT")}
                            <span className="d2h-split-ln-num">
                                {oldLineNum}
                            </span>
                        </div>
                    </td>
                    <td
                        className={`d2h-split-code d2h-cntx ${
                            rowSelected ? "d2h-split-selected" : ""
                        }`}
                        onMouseEnter={() => setHovered("LEFT")}
                    >
                        <div className="d2h-split-code-line">
                            <span className="d2h-code-line-ctn">
                                {content || <br />}
                            </span>
                        </div>
                    </td>
                    <td
                        className={`d2h-code-linenumber d2h-split-ln d2h-split-new d2h-cntx ${
                            showRangeIndicator
                                ? "border-blue-400 border-l-4"
                                : ""
                        } ${rowSelected ? "d2h-split-selected" : ""}`}
                        onMouseDown={() =>
                            onLineMouseDown?.(lineNum, "RIGHT", {
                                oldLine: lineNum,
                                newLine: lineNum,
                            })
                        }
                        onMouseEnter={() => setHovered("RIGHT")}
                        onClick={(event) =>
                            onLineSelect?.(lineNum, "RIGHT", event.shiftKey, {
                                oldLine: lineNum,
                                newLine: lineNum,
                            })
                        }
                        title="Copy permalink"
                    >
                        <div className="absolute inset-0">
                            {showCommentButton &&
                                onStartComment &&
                                renderPlusButton("RIGHT")}
                            <span className="d2h-split-ln-num">{lineNum}</span>
                        </div>
                    </td>
                    <td
                        className={`d2h-split-code d2h-cntx ${
                            rowSelected ? "d2h-split-selected" : ""
                        }`}
                        onMouseEnter={() => setHovered("RIGHT")}
                    >
                        <div className="d2h-split-code-line">
                            <span className="d2h-code-line-ctn">
                                {content || <br />}
                            </span>
                        </div>
                    </td>
                </tr>
                {attachments}
            </>
        );
    }

    return (
        <>
            <tr
                data-new-line={lineNum}
                data-old-line={oldLineNum}
                id={id}
                className={
                    [
                        showCommentButton ? "group" : "",
                        rowSelected ? "line-highlighted" : "",
                    ]
                        .filter(Boolean)
                        .join(" ") || undefined
                }
            >
                <td
                    className={`d2h-code-linenumber d2h-cntx ${
                        showRangeIndicator ? "border-blue-400 border-l-4" : ""
                    }`}
                    onMouseDown={() =>
                        onLineMouseDown?.(lineNum, "RIGHT", {
                            oldLine: oldLineNum,
                            newLine: lineNum,
                        })
                    }
                    onClick={(event) =>
                        onLineSelect?.(lineNum, "RIGHT", event.shiftKey, {
                            oldLine: oldLineNum,
                            newLine: lineNum,
                        })
                    }
                    title="Copy permalink"
                >
                    <div className="d2h-ln-overlay absolute">
                        {showCommentButton &&
                            onStartComment &&
                            renderPlusButton("RIGHT")}
                        <div className="line-num1">{oldLineNum}</div>
                        <div className="line-num2">{lineNum}</div>
                    </div>
                </td>
                <td className="d2h-cntx">
                    <div className="d2h-code-line" style={{ display: "flex" }}>
                        <span className="d2h-code-line-ctn">
                            {content || <br />}
                        </span>
                    </div>
                </td>
            </tr>
            {attachments}
        </>
    );
}
