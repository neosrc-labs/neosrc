"use client";

import { Fragment, useCallback } from "react";
import { InlineCommentThread } from "../comment/inline-comment-thread";
import { groupReviewCommentThreads } from "../comment/review-comment-threads";
import type { BlockRowsSharedProps } from "./diff-block-rows";
import { DiffCommentButton } from "./diff-comment-button";
import { DiffLineCommentEditor } from "./diff-line-comment-editor";
import { DiffLineRow } from "./diff-line-row";
import { isLastLineOfRange } from "./model";
import { type DiffRowLines, isRowSelected } from "./use-diff-line-selection";

export function UnifiedBlockRows({
    block,
    commentsByLine,
    positionMap,
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
                                className={`d2h-code-linenumber ${typeClass}`}
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
                                        <DiffCommentButton
                                            line={commentLine}
                                            side={side}
                                            rowLines={{
                                                oldLine: oldNum,
                                                newLine: newNum,
                                            }}
                                            isActive={isActive}
                                            activeComment={activeComment}
                                            onStartComment={onStartComment}
                                            onDragStart={onCommentDragStart}
                                            visibilityClass="hidden group-hover:block"
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
                                    <span
                                        className="d2h-code-line-ctn"
                                        data-line-side={lineSide}
                                        data-line-number={lineNum}
                                    >
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
                                <td className={`p-0 ${typeClass}`}>
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
