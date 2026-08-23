"use client";

import { Plus } from "lucide-react";
import { Fragment, useCallback } from "react";
import { InlineCommentThread } from "../inline-comment-thread";
import { groupReviewCommentThreads } from "../review-comment-threads";
import type { BlockRowsSharedProps } from "./diff-block-rows";
import { DiffLineCommentEditor } from "./diff-line-comment-editor";
import { DiffLineRow } from "./diff-line-row";
import { isLastLineOfRange } from "./model";
import { type DiffRowLines, isRowSelected } from "./use-diff-line-selection";

export function UnifiedBlockRows({
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

    return (
        <>
            {block.lines.map((line) => {
                const type = line.type;
                const typeClass =
                    type === "insert"
                        ? "d2h-ins d2h-change"
                        : type === "delete"
                          ? "d2h-del d2h-change"
                          : "d2h-cntx";

                const oldNum =
                    "oldNumber" in line
                        ? (line as { oldNumber: number }).oldNumber
                        : undefined;
                const newNum =
                    "newNumber" in line
                        ? (line as { newNumber: number }).newNumber
                        : undefined;

                const commentLine = newNum ?? oldNum ?? 0;
                const side = type === "delete" ? "LEFT" : "RIGHT";

                const lineComments =
                    commentsByLine.get(`${commentLine}-${side}`) ?? [];
                const isActive =
                    activeComment?.type === "line" &&
                    activeComment.line === commentLine &&
                    activeComment.side === side;
                const hasComments = lineComments.length > 0;

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
                    (multiLineRanges.get(`${commentLine}-${side}`)?.length ??
                        0) > 0;

                const showRangeIndicator = isInActiveRange || hasMultiLineRange;

                const content = line.content.slice(1);

                const lineId = fileHash
                    ? `diff-${fileHash}${newNum != null ? `R${newNum}` : `L${oldNum}`}`
                    : undefined;
                const lineNum = newNum ?? oldNum ?? 0;
                const lineSide = type === "delete" ? "LEFT" : "RIGHT";
                // The unified row is one line: it is selected when the range
                // covers it, regardless of which side the range lives on.
                const rowSelected = isRowSelected(
                    selectedRange,
                    oldNum,
                    newNum,
                );

                return (
                    <Fragment key={`${oldNum}-${newNum}-${line.content}`}>
                        <DiffLineRow
                            className={`group ${rowSelected ? "line-highlighted" : ""}`}
                            dataNewLine={newNum}
                            dataOldLine={oldNum}
                            id={lineId}
                        >
                            <td
                                className={`d2h-code-linenumber ${typeClass} ${showRangeIndicator ? "border-blue-400 border-l-4" : ""}`}
                                onMouseDown={() =>
                                    onLineMouseDown?.(lineNum, lineSide, {
                                        oldLine: oldNum,
                                        newLine: newNum,
                                    })
                                }
                                onClick={(e) => {
                                    const num = newNum ?? oldNum ?? 0;
                                    handleLineClick(
                                        num,
                                        type === "delete" ? "LEFT" : "RIGHT",
                                        e,
                                        {
                                            oldLine: oldNum,
                                            newLine: newNum,
                                        },
                                    );
                                }}
                                title="Copy permalink"
                            >
                                <div className="d2h-ln-overlay absolute">
                                    {showCommentButton && onStartComment && (
                                        <Plus
                                            size={24}
                                            className="absolute -right-5 z-10 hidden rounded-md bg-blue-500 p-0.5 text-white group-hover:block"
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                onCommentDragStart?.(
                                                    commentLine,
                                                    side as "LEFT" | "RIGHT",
                                                    {
                                                        oldLine: oldNum,
                                                        newLine: newNum,
                                                    },
                                                );
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (
                                                    e.shiftKey &&
                                                    activeComment?.type ===
                                                        "line" &&
                                                    activeComment.side === side
                                                ) {
                                                    const start = Math.min(
                                                        activeComment.line,
                                                        commentLine,
                                                    );
                                                    const end = Math.max(
                                                        activeComment.line,
                                                        commentLine,
                                                    );
                                                    onStartComment({
                                                        type: "line",
                                                        line: end,
                                                        side,
                                                        startLine: start,
                                                        startSide: side,
                                                    });
                                                } else {
                                                    onStartComment(
                                                        isActive
                                                            ? null
                                                            : {
                                                                  type: "line",
                                                                  line: commentLine,
                                                                  side,
                                                              },
                                                    );
                                                }
                                            }}
                                        />
                                    )}
                                    <div className="line-num1">
                                        {oldNum !== undefined ? oldNum : ""}
                                    </div>
                                    <div className="line-num2">
                                        {newNum !== undefined ? newNum : ""}
                                    </div>
                                </div>
                            </td>
                            <td className={typeClass}>
                                <div
                                    className="d2h-code-line"
                                    style={{
                                        display: "flex",
                                        width: "100%",
                                        paddingRight: "8px",
                                    }}
                                >
                                    <span className="d2h-code-line-ctn">
                                        {content || <br />}
                                    </span>
                                </div>
                            </td>
                        </DiffLineRow>
                        {showComments &&
                            hasComments &&
                            groupReviewCommentThreads(lineComments)
                                .filter((thread) =>
                                    isLastLineOfRange(
                                        thread.parent,
                                        positionMap,
                                        commentLine,
                                    ),
                                )
                                .map((thread) => (
                                    <tr key={`thread-${thread.parent.id}`}>
                                        <td
                                            className={`d2h-thread-ln ${typeClass}`}
                                        />
                                        <td className={`p-0 ${typeClass}`}>
                                            <InlineCommentThread
                                                parentComment={thread.parent}
                                                replies={thread.replies}
                                                owner={owner as string}
                                                repo={repo as string}
                                                number={Number(pullNumber ?? 0)}
                                                pendingReviewId={
                                                    pendingReviewId
                                                }
                                                permissionContext={
                                                    permissionContext
                                                }
                                            />
                                        </td>
                                    </tr>
                                ))}
                        {isActive && (
                            <tr>
                                <td className={`d2h-thread-ln ${typeClass}`} />
                                <td className="border-border border-t p-0">
                                    <DiffLineCommentEditor
                                        value={commentBody}
                                        onChange={
                                            onCommentBodyChange ?? (() => {})
                                        }
                                        onCancel={onCancelComment ?? (() => {})}
                                        footerActions={footerActions}
                                        isPending={commentPending}
                                        isError={commentError}
                                        owner={owner as string}
                                        repo={repo as string}
                                    />
                                </td>
                            </tr>
                        )}
                    </Fragment>
                );
            })}
        </>
    );
}
