"use client";

import { Plus } from "lucide-react";
import { Fragment, type ReactNode, useCallback, useState } from "react";
import type { PullRequestPermissionContext } from "~/app/gh/[owner]/[repo]/pull/[number]/permissions-utils";
import type { ReviewComment } from "~/server/github";
import { InlineCommentThread } from "../inline-comment-thread";
import type { FooterAction } from "../markdown/markdown-editor";
import { groupReviewCommentThreads } from "../review-comment-threads";
import type { BlockRowsSharedProps } from "./diff-block-rows";
import { DiffLineCommentEditor } from "./diff-line-comment-editor";
import { DiffLineRow } from "./diff-line-row";
import type { SplitRow } from "./model";
import { buildSplitRows, isLastLineOfRange } from "./model";
import type { DiffAnchor, DiffCommentTarget, DiffSide } from "./types";
import { type DiffRowLines, isRowSelected } from "./use-diff-line-selection";

// Per-side comment/selection state for a (line, side) anchor. In split
// view every row has up to two anchors (old + new), each with its own
// comment button, range indicator and permalink.
function buildSplitSideState(
    commentLine: number,
    side: DiffSide,
    {
        commentsByLine,
        activeComment,
        commentDragRange,
        multiLineRanges,
    }: {
        commentsByLine: Map<string, ReviewComment[]>;
        activeComment: DiffCommentTarget | null;
        commentDragRange: {
            startLine: number;
            endLine: number;
            side: DiffSide;
        } | null;
        multiLineRanges: Map<string, string[]>;
    },
) {
    const lineComments = commentsByLine.get(`${commentLine}-${side}`) ?? [];
    const isActive =
        activeComment?.type === "line" &&
        activeComment.line === commentLine &&
        activeComment.side === side;
    const isInActiveRange =
        (activeComment?.type === "line" &&
            activeComment.startLine != null &&
            activeComment.side === side &&
            commentLine >= activeComment.startLine &&
            commentLine <= activeComment.line) ||
        (commentDragRange != null &&
            commentDragRange.side === side &&
            commentLine >= commentDragRange.startLine &&
            commentLine <= commentDragRange.endLine);
    const hasMultiLineRange =
        (multiLineRanges.get(`${commentLine}-${side}`)?.length ?? 0) > 0;
    return {
        lineComments,
        isActive,
        showRangeIndicator: isInActiveRange || hasMultiLineRange,
    };
}

// Comment anchors: context lines comment on the new side (like unified
// view); changed lines anchor to their own side. The tint class mirrors the
// anchored line's code-cell background so the comment area reads as part of
// that line.
function buildSplitRowAnchors({
    isContext,
    oldNum,
    newNum,
    oldCodeClass,
    newCodeClass,
}: {
    isContext: boolean;
    oldNum?: number | null;
    newNum?: number | null;
    oldCodeClass: string;
    newCodeClass: string;
}): Array<{ line: number; side: DiffSide; typeClass: string }> {
    const anchors: Array<{
        line: number;
        side: DiffSide;
        typeClass: string;
    }> = [];
    if (isContext && newNum != null) {
        anchors.push({ line: newNum, side: "RIGHT", typeClass: newCodeClass });
    } else {
        if (oldNum != null)
            anchors.push({
                line: oldNum,
                side: "LEFT",
                typeClass: oldCodeClass,
            });
        if (newNum != null)
            anchors.push({
                line: newNum,
                side: "RIGHT",
                typeClass: newCodeClass,
            });
    }
    return anchors;
}

// Inline comment threads for every anchor of a split row (old + new side),
// one row per thread. The comment spans from the anchored side's code column
// to the end of the table (spacer cells occupy the leading columns).
function renderSplitAttachmentRows({
    anchors,
    commentsByLine,
    positionMap,
    owner,
    repo,
    pullNumber,
    pendingReviewId,
    permissionContext,
}: {
    anchors: Array<{ line: number; side: DiffSide; typeClass: string }>;
    commentsByLine: Map<string, ReviewComment[]>;
    positionMap: Map<number, DiffAnchor>;
    owner?: string;
    repo?: string;
    pullNumber?: number | string;
    pendingReviewId?: number | null;
    permissionContext: PullRequestPermissionContext;
}) {
    const rows: ReactNode[] = [];
    const seenThreads = new Set<number>();
    for (const { line, side, typeClass } of anchors) {
        const lineComments = commentsByLine.get(`${line}-${side}`) ?? [];
        for (const thread of groupReviewCommentThreads(lineComments)) {
            if (!isLastLineOfRange(thread.parent, positionMap, line)) continue;
            if (seenThreads.has(thread.parent.id)) continue;
            seenThreads.add(thread.parent.id);
            rows.push(
                <tr key={`thread-${thread.parent.id}`}>
                    {side === "LEFT" ? (
                        <>
                            <td className={`d2h-split-ln ${typeClass}`} />
                            <td
                                colSpan={3}
                                className={`p-0 pl-[0.75em] ${typeClass}`}
                            >
                                <InlineCommentThread
                                    parentComment={thread.parent}
                                    replies={thread.replies}
                                    owner={owner as string}
                                    repo={repo as string}
                                    number={Number(pullNumber ?? 0)}
                                    pendingReviewId={pendingReviewId}
                                    permissionContext={permissionContext}
                                />
                            </td>
                        </>
                    ) : (
                        <>
                            <td className="d2h-empty-side" />
                            <td className="d2h-empty-side" />
                            <td className={`d2h-split-ln ${typeClass}`} />
                            <td className={`p-0 pl-[0.75em] ${typeClass}`}>
                                <InlineCommentThread
                                    parentComment={thread.parent}
                                    replies={thread.replies}
                                    owner={owner as string}
                                    repo={repo as string}
                                    number={Number(pullNumber ?? 0)}
                                    pendingReviewId={pendingReviewId}
                                    permissionContext={permissionContext}
                                />
                            </td>
                        </>
                    )}
                </tr>,
            );
        }
    }
    return rows;
}

// The in-line comment editor row for a split row: the anchored side's
// line-number column gets the line's lighter shade, and the editor aligns
// with the anchored side's code column (empty cells occupy the rest).
function renderSplitEditorRow({
    side,
    typeClass,
    commentBody,
    onCommentBodyChange,
    onCancelComment,
    footerActions,
    commentPending,
    commentError,
    owner,
    repo,
}: {
    side: DiffSide;
    typeClass: string;
    commentBody?: string;
    onCommentBodyChange?: (value: string) => void;
    onCancelComment?: () => void;
    footerActions?: FooterAction[];
    commentPending?: boolean;
    commentError?: boolean;
    owner?: string;
    repo?: string;
}) {
    const editor = (
        <DiffLineCommentEditor
            value={commentBody ?? ""}
            onChange={onCommentBodyChange ?? (() => {})}
            onCancel={onCancelComment ?? (() => {})}
            footerActions={footerActions}
            isPending={commentPending ?? false}
            isError={commentError ?? false}
            owner={owner ?? ""}
            repo={repo ?? ""}
        />
    );
    return (
        <tr>
            {side === "LEFT" ? (
                <>
                    <td className={`d2h-split-ln ${typeClass}`} />
                    <td colSpan={3} className="border-border border-t p-0">
                        {editor}
                    </td>
                </>
            ) : (
                <>
                    <td className="d2h-empty-side" />
                    <td className="d2h-empty-side" />
                    <td className={`d2h-split-ln ${typeClass}`} />
                    <td className="border-border border-t p-0">{editor}</td>
                </>
            )}
        </tr>
    );
}

export function SplitBlockRows({
    block,
    commentsByLine,
    positionMap,
    multiLineRanges,
    owner,
    repo,
    fileHash,
    selectedRange,
    onLineSelect,
    onLineMouseDown,
    commentProps,
}: BlockRowsSharedProps) {
    // Which side of which row the pointer is over. The comment buttons are
    // per side, so they must only appear on the hovered side, not the whole
    // row like in unified view.
    const [hover, setHover] = useState<{
        key: string;
        side: DiffSide;
    } | null>(null);
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
    } = commentProps;

    const handleLineClick = useCallback(
        (
            lineNum: number,
            side: string,
            e: React.MouseEvent,
            rowLines?: DiffRowLines,
        ) => {
            onLineSelect?.(lineNum, side, e.shiftKey, rowLines);
        },
        [onLineSelect],
    );

    const renderPlusButton = (
        visible: boolean,
        commentLine: number,
        side: DiffSide,
        isActive: boolean,
        rowLines?: DiffRowLines,
    ) => (
        <Plus
            size={24}
            className={`absolute -right-5 z-10 ${visible ? "block" : "hidden"} rounded-md bg-blue-500 p-0.5 text-white`}
            onMouseDown={(e) => {
                e.stopPropagation();
                onCommentDragStart?.(commentLine, side, rowLines);
            }}
            onClick={(e) => {
                e.stopPropagation();
                if (
                    e.shiftKey &&
                    activeComment?.type === "line" &&
                    activeComment.side === side
                ) {
                    const start = Math.min(activeComment.line, commentLine);
                    const end = Math.max(activeComment.line, commentLine);
                    onStartComment?.({
                        type: "line",
                        line: end,
                        side,
                        startLine: start,
                        startSide: side,
                    });
                } else {
                    onStartComment?.(
                        isActive
                            ? null
                            : { type: "line", line: commentLine, side },
                    );
                }
            }}
        />
    );

    const renderSplitRow = (row: SplitRow) => {
        const oldLine =
            row.kind === "context"
                ? row.line
                : row.kind === "paired"
                  ? row.oldLine
                  : row.kind === "del"
                    ? row.line
                    : null;
        const newLine =
            row.kind === "context"
                ? row.line
                : row.kind === "paired"
                  ? row.newLine
                  : row.kind === "add"
                    ? row.line
                    : null;

        const isContext = row.kind === "context";
        const oldNum = oldLine?.oldNumber;
        const newNum = newLine?.newNumber;
        const oldContent = oldLine ? oldLine.content.slice(1) : "";
        const newContent = newLine ? newLine.content.slice(1) : "";

        const oldState =
            oldNum != null
                ? buildSplitSideState(oldNum, "LEFT", {
                      commentsByLine,
                      activeComment,
                      commentDragRange,
                      multiLineRanges,
                  })
                : null;
        const newState =
            newNum != null
                ? buildSplitSideState(newNum, "RIGHT", {
                      commentsByLine,
                      activeComment,
                      commentDragRange,
                      multiLineRanges,
                  })
                : null;

        const isRowActive =
            (oldState?.isActive ?? false) || (newState?.isActive ?? false);
        // Selection covers rows: a covered row highlights all of its existing
        // sides (both halves of a two-sided row, the one side of an unpaired
        // addition/deletion) and never the empty opposite side.
        const rowSelected = isRowSelected(
            selectedRange,
            oldNum ?? undefined,
            newNum ?? undefined,
        );
        const oldHighlighted = rowSelected && oldNum != null;
        const newHighlighted = rowSelected && newNum != null;

        // The row carries the new-side id (like unified view); old-side
        // anchors of the same row get their own id on the old number cell so
        // L-permalinks still scroll into view.
        const primaryId = fileHash
            ? `diff-${fileHash}${newNum != null ? `R${newNum}` : `L${oldNum}`}`
            : undefined;
        const oldSideId =
            fileHash && oldNum != null && newNum != null
                ? `diff-${fileHash}L${oldNum}`
                : undefined;

        const oldCodeClass = !oldLine
            ? "d2h-empty-side"
            : oldLine.type === "delete"
              ? "d2h-del d2h-change"
              : "d2h-cntx";
        const newCodeClass = !newLine
            ? "d2h-empty-side"
            : newLine.type === "insert"
              ? "d2h-ins d2h-change"
              : "d2h-cntx";
        const oldLnClass = !oldLine
            ? "d2h-empty-side"
            : oldLine.type === "delete"
              ? "d2h-del"
              : "d2h-cntx";
        const newLnClass = !newLine
            ? "d2h-empty-side"
            : newLine.type === "insert"
              ? "d2h-ins"
              : "d2h-cntx";

        const anchors = buildSplitRowAnchors({
            isContext,
            oldNum,
            newNum,
            oldCodeClass,
            newCodeClass,
        });

        const rowKey =
            row.kind === "context"
                ? `c-${oldNum}-${newNum}`
                : row.kind === "paired"
                  ? `p-${oldNum}-${newNum}`
                  : row.kind === "del"
                    ? `d-${oldNum}`
                    : `a-${newNum}`;

        const hovered = hover?.key === rowKey ? hover.side : null;
        const hoverLeft = () => setHover({ key: rowKey, side: "LEFT" });
        const hoverRight = () => setHover({ key: rowKey, side: "RIGHT" });
        const rowLines = {
            oldLine: oldNum ?? undefined,
            newLine: newNum ?? undefined,
        };

        return (
            <Fragment key={rowKey}>
                <DiffLineRow
                    dataNewLine={newNum}
                    dataOldLine={oldNum}
                    id={primaryId}
                    onMouseLeave={() =>
                        setHover((h) => (h?.key === rowKey ? null : h))
                    }
                >
                    {oldNum != null ? (
                        <td
                            className={`d2h-code-linenumber d2h-split-ln ${oldLnClass} ${oldState?.showRangeIndicator ? "border-blue-400 border-l-4" : ""} ${oldHighlighted ? "d2h-split-selected" : ""}`}
                            id={oldSideId}
                            onMouseDown={() =>
                                onLineMouseDown?.(oldNum, "LEFT", rowLines)
                            }
                            onMouseEnter={hoverLeft}
                            onClick={(e) =>
                                handleLineClick(oldNum, "LEFT", e, rowLines)
                            }
                            title="Copy permalink"
                        >
                            <div className="absolute inset-0">
                                {showCommentButton &&
                                    onStartComment &&
                                    oldLine != null &&
                                    (isContext || oldLine.type === "delete") &&
                                    renderPlusButton(
                                        hovered === "LEFT",
                                        isContext ? (newNum as number) : oldNum,
                                        isContext ? "RIGHT" : "LEFT",
                                        isContext
                                            ? (newState?.isActive ?? false)
                                            : (oldState?.isActive ?? false),
                                        rowLines,
                                    )}
                                <span className="d2h-split-ln-num">
                                    {oldNum}
                                </span>
                            </div>
                        </td>
                    ) : (
                        <td className="d2h-code-linenumber d2h-split-ln d2h-empty-side" />
                    )}
                    <td
                        className={`d2h-split-code ${oldCodeClass} ${oldHighlighted ? "d2h-split-selected" : ""}`}
                        onMouseEnter={hoverLeft}
                    >
                        <div className="d2h-split-code-line">
                            <span className="d2h-code-line-ctn">
                                {oldContent || <br />}
                            </span>
                        </div>
                    </td>
                    {newNum != null ? (
                        <td
                            className={`d2h-code-linenumber d2h-split-ln d2h-split-new ${newLnClass} ${newState?.showRangeIndicator ? "border-blue-400 border-l-4" : ""} ${newHighlighted ? "d2h-split-selected" : ""}`}
                            onMouseDown={() =>
                                onLineMouseDown?.(newNum, "RIGHT", rowLines)
                            }
                            onMouseEnter={hoverRight}
                            onClick={(e) =>
                                handleLineClick(newNum, "RIGHT", e, rowLines)
                            }
                            title="Copy permalink"
                        >
                            <div className="absolute inset-0">
                                {showCommentButton &&
                                    onStartComment &&
                                    newLine != null &&
                                    (isContext || newLine.type === "insert") &&
                                    renderPlusButton(
                                        hovered === "RIGHT",
                                        newNum,
                                        "RIGHT",
                                        newState?.isActive ?? false,
                                        rowLines,
                                    )}
                                <span className="d2h-split-ln-num">
                                    {newNum}
                                </span>
                            </div>
                        </td>
                    ) : (
                        <td className="d2h-code-linenumber d2h-split-ln d2h-empty-side" />
                    )}
                    <td
                        className={`d2h-split-code ${newCodeClass} ${newHighlighted ? "d2h-split-selected" : ""}`}
                        onMouseEnter={hoverRight}
                    >
                        <div className="d2h-split-code-line">
                            <span className="d2h-code-line-ctn">
                                {newContent || <br />}
                            </span>
                        </div>
                    </td>
                </DiffLineRow>
                {showComments &&
                    renderSplitAttachmentRows({
                        anchors,
                        commentsByLine,
                        positionMap,
                        owner,
                        repo,
                        pullNumber,
                        pendingReviewId,
                        permissionContext,
                    })}
                {isRowActive &&
                    renderSplitEditorRow({
                        side:
                            activeComment?.type === "line"
                                ? activeComment.side
                                : "RIGHT",
                        typeClass:
                            activeComment?.type === "line" &&
                            activeComment.side === "LEFT"
                                ? oldCodeClass
                                : newCodeClass,
                        commentBody,
                        onCommentBodyChange,
                        onCancelComment,
                        footerActions,
                        commentPending,
                        commentError,
                        owner,
                        repo,
                    })}
            </Fragment>
        );
    };

    return buildSplitRows(block).map((row) => renderSplitRow(row));
}
