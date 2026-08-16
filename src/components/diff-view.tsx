"use client";

import type { ColorSchemeType, DiffBlock } from "diff2html/lib/types";
import "diff2html/bundles/css/diff2html.min.css";
import { ArrowDownFromLine, ArrowUpFromLine, Plus } from "lucide-react";
import { useTheme } from "next-themes";
import {
    Fragment,
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import type { PullRequestPermissionContext } from "~/app/gh/[owner]/[repo]/pull/[number]/permissions-utils";
import { useFileContent } from "~/hooks/use-file-content";
import type { ReviewComment } from "~/server/github";
import type { DiffViewMode } from "~/utils/diff-view";
import { filenameHash } from "~/utils/filename-hash";
import { getDiffGapSize } from "./diff/diff-block-rows";
import { DiffContextRow } from "./diff/diff-context-row";
import { DiffLineCommentEditor } from "./diff/diff-line-comment-editor";
import { DiffLineRow } from "./diff/diff-line-row";
import { DiffTable } from "./diff/diff-table";
import type { SplitRow } from "./diff/model";
import {
    buildDiffPositionMap,
    buildSplitRows,
    createDiffRenderItems,
    getDiffLanguage,
    isLastLineOfRange,
    parseDiffPatch,
    resolveDiffCommentAnchor,
} from "./diff/model";
import type {
    DiffAnchor,
    DiffCommentTarget,
    DiffGap,
    DiffRenderItem,
    DiffRowCommentProps,
    DiffSide,
    GapExpansion,
} from "./diff/types";
import { useDiffCommentSelection } from "./diff/use-diff-comment-selection";
import { useDiffHashNavigation } from "./diff/use-diff-hash-navigation";
import {
    type DiffRowLines,
    isRowSelected,
    useDiffLineSelection,
} from "./diff/use-diff-line-selection";
import { useDiffSyntaxHighlighting } from "./diff/use-diff-syntax-highlighting";
import { InlineCommentThread } from "./inline-comment-thread";
import type { FooterAction } from "./markdown/markdown-editor";
import { groupReviewCommentThreads } from "./review-comment-threads";

export type { DiffCommentTarget } from "./diff/types";

// Breathing room between the sticky bars and the line a permalink scrolls to.
const SCROLL_TARGET_PADDING = 12;

// Number of context lines revealed by a single expand click. Clicking again
// reveals the next chunk until the gap is exhausted.
const GAP_EXPAND_STEP = 20;

interface DiffViewProps extends DiffCommentProps {
    patch: string;
    filename: string;
    headSha?: string;
    expandAllContext?: boolean;
    view?: DiffViewMode;
}

/** Comment-related props shared by the diff views (DiffView, SvgDiff). */
export interface DiffCommentProps {
    comments?: ReviewComment[];
    showComments?: boolean;
    showCommentButton?: boolean;
    activeComment?: DiffCommentTarget | null;
    onStartComment?: (ac: DiffCommentTarget | null) => void;
    commentBody?: string;
    onCommentBodyChange?: (body: string) => void;
    footerActions?: FooterAction[];
    commentPending?: boolean;
    commentError?: boolean;
    onCancelComment?: () => void;
    owner?: string;
    repo?: string;
    pullNumber?: number | string;
    pendingReviewId?: number | null;
    permissionContext: PullRequestPermissionContext;
}

export function DiffView({
    patch,
    filename,
    comments = [],
    showComments = false,
    showCommentButton = false,
    activeComment = null,
    onStartComment,
    commentBody = "",
    onCommentBodyChange,
    footerActions,
    commentPending = false,
    commentError = false,
    onCancelComment,
    owner,
    repo,
    pullNumber,
    pendingReviewId,
    permissionContext,
    headSha,
    expandAllContext = false,
    view = "unified",
}: DiffViewProps) {
    const { resolvedTheme } = useTheme();

    const parsed = useMemo(
        () =>
            parseDiffPatch(
                patch,
                filename,
                resolvedTheme === "dark"
                    ? ("dark" as ColorSchemeType)
                    : ("light" as ColorSchemeType),
            ),
        [patch, filename, resolvedTheme],
    );

    const diffRef = useRef<HTMLDivElement>(null);

    const language = useMemo(() => getDiffLanguage(filename), [filename]);

    const fileHash = useMemo(() => filenameHash(filename), [filename]);

    const lineSelection = useDiffLineSelection(fileHash);
    const commentSelection = useDiffCommentSelection({
        activeComment,
        onStartComment,
        selectedRange: lineSelection.selectedRange,
        onSelectionChange: lineSelection.setSelectedRange,
        onOrdinaryLineMouseDown: lineSelection.onLineMouseDown,
        onOrdinaryTableMouseOver: lineSelection.onTableMouseOver,
    });
    const { selectedRange } = lineSelection;
    const {
        commentDragRange,
        onCommentDragStart,
        onCommentLineMouseDown,
        onCommentTableMouseOver,
    } = commentSelection;

    const [expandedGaps, setExpandedGaps] = useState<Map<string, GapExpansion>>(
        () => new Map(),
    );

    // Track how many lines of each gap are revealed from the top (down) and
    // the bottom (up); a click reveals GAP_EXPAND_STEP more lines from one
    // end until the gap is exhausted.
    const handleGapExpand = useCallback(
        (key: string, expansion: GapExpansion) => {
            setExpandedGaps((prev) => {
                const current = prev.get(key) ?? { top: 0, bottom: 0 };
                const next = {
                    top: Math.max(current.top, expansion.top),
                    bottom: Math.max(current.bottom, expansion.bottom),
                };
                if (next.top === current.top && next.bottom === current.bottom)
                    return prev;
                const map = new Map(prev);
                map.set(key, next);
                return map;
            });
        },
        [],
    );

    useEffect(() => {
        if (!expandAllContext) {
            setExpandedGaps(new Map());
        }
    }, [expandAllContext]);

    const expandedLineCount = useMemo(
        () =>
            Array.from(expandedGaps.values()).reduce(
                (sum, { top, bottom }) => sum + top + bottom,
                0,
            ),
        [expandedGaps],
    );
    useDiffSyntaxHighlighting({
        diffRef,
        language,
        enabled: Boolean(parsed),
        rerenderKey: `${expandedLineCount}-${expandAllContext}`,
    });

    const positionMap = useMemo(() => buildDiffPositionMap(parsed), [parsed]);

    const commentsByLine = useMemo(() => {
        const map = new Map<string, ReviewComment[]>();
        for (const comment of comments) {
            const anchor = resolveDiffCommentAnchor(comment, positionMap);
            if (!anchor) continue;
            const startLine = comment.start_line ?? anchor.line;
            for (let line = startLine; line <= anchor.line; line++) {
                const key = `${line}-${anchor.side}`;
                const existing = map.get(key) ?? [];
                existing.push(comment);
                map.set(key, existing);
            }
        }
        return map;
    }, [comments, positionMap]);

    const multiLineRanges = useMemo(() => {
        const ranges = new Map<string, string[]>();
        for (const comment of comments) {
            const anchor = resolveDiffCommentAnchor(comment, positionMap);
            if (!anchor) continue;
            const startLine = comment.start_line;
            if (startLine == null || startLine === anchor.line) continue;
            for (let line = startLine; line <= anchor.line; line++) {
                const key = `${line}-${anchor.side}`;
                const existing = ranges.get(key) ?? [];
                const rangeId = `${comment.id}`;
                if (!existing.includes(rangeId)) {
                    existing.push(rangeId);
                    ranges.set(key, existing);
                }
            }
        }
        return ranges;
    }, [comments, positionMap]);

    const renderItems = useMemo(() => createDiffRenderItems(parsed), [parsed]);

    const renderItemsRef = useRef(renderItems);
    renderItemsRef.current = renderItems;

    // Expose the sticky-header offset so native fragment scrolls (initial load,
    // pressing Enter in the URL bar) also land the line below the sticky bars.
    // The offset is the same for every diff on the page, so setting the CSS
    // variable from any rendered diff is enough.
    useEffect(() => {
        const el = diffRef.current;
        if (!parsed || !el) return;
        const offset = getStickyTopHeight(el) + SCROLL_TARGET_PADDING;
        document.documentElement.style.setProperty(
            "--diff-scroll-offset",
            `${offset}px`,
        );
    }, [parsed]);

    useDiffHashNavigation({
        fileHash,
        renderItemsRef,
        setExpandedGaps,
        setSelectedRange: lineSelection.setSelectedRange,
    });

    if (!parsed) {
        return null;
    }

    const commentProps: DiffRowCommentProps = {
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
    };

    return (
        <DiffTable
            colorScheme={resolvedTheme === "light" ? "light" : "dark"}
            diffRef={diffRef}
            onMouseOver={onCommentTableMouseOver}
            view={view}
        >
            <DiffTableBody
                items={renderItems}
                expandAllContext={expandAllContext}
                expandedGaps={expandedGaps}
                onGapExpand={handleGapExpand}
                owner={owner}
                repo={repo}
                headSha={headSha}
                filename={filename}
                fileHash={fileHash}
                view={view}
                selectedRange={selectedRange}
                onLineSelect={lineSelection.onLineSelect}
                onLineMouseDown={onCommentLineMouseDown}
                commentsByLine={commentsByLine}
                positionMap={positionMap}
                multiLineRanges={multiLineRanges}
                commentProps={commentProps}
            />
        </DiffTable>
    );
}

/** Gap/navigation props shared by the diff table row components. */
interface DiffRowNavigationProps {
    gapKey?: string;
    onGapExpand?: (key: string, expansion: GapExpansion) => void;
    headSha?: string;
    filename?: string;
    fileHash?: string;
    view?: DiffViewMode;
    selectedRange?: {
        startLine: number;
        endLine: number;
        side: string;
    } | null;
    onLineSelect?: (
        lineNum: number,
        side: string,
        shiftKey: boolean,
        rowLines?: DiffRowLines,
    ) => void;
    onLineMouseDown?: (
        lineNum: number,
        side: string,
        rowLines?: DiffRowLines,
    ) => void;
}
interface BlockRowsProps extends DiffRowNavigationProps {
    block: DiffBlock;
    commentsByLine: Map<string, ReviewComment[]>;
    positionMap: Map<number, DiffAnchor>;
    multiLineRanges: Map<string, string[]>;
    owner: string | undefined;
    repo: string | undefined;
    gap?: DiffGap;
    gapExpansion: GapExpansion;
    commentProps: DiffRowCommentProps;
}

interface SplitBlockRowsProps {
    block: DiffBlock;
    commentsByLine: Map<string, ReviewComment[]>;
    positionMap: Map<number, DiffAnchor>;
    multiLineRanges: Map<string, string[]>;
    owner: string | undefined;
    repo: string | undefined;
    fileHash: string | undefined;
    selectedRange?: {
        startLine: number;
        endLine: number;
        side: string;
    } | null;
    onLineSelect?: (
        lineNum: number,
        side: string,
        shiftKey: boolean,
        rowLines?: DiffRowLines,
    ) => void;
    onLineMouseDown?: (
        lineNum: number,
        side: string,
        rowLines?: DiffRowLines,
    ) => void;
    commentProps: DiffRowCommentProps;
}

function UnifiedBlockRows({
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
}: SplitBlockRowsProps) {
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
                                <div className="absolute">
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
                                            colSpan={2}
                                            className="p-0 dark:bg-zinc-950"
                                        >
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
                                <td
                                    colSpan={2}
                                    className="border-border border-t p-2"
                                >
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

function SplitBlockRows({
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
}: SplitBlockRowsProps) {
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

    // Per-side comment/selection state for a (line, side) anchor. In split
    // view every row has up to two anchors (old + new), each with its own
    // comment button, range indicator and permalink.
    const buildSideState = (commentLine: number, side: DiffSide) => {
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
    };

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

    // Inline comment threads for every anchor of a split row (old + new
    // side), one row per thread spanning the full table width.
    const renderAttachmentRows = (
        anchors: Array<{ line: number; side: DiffSide }>,
    ) => {
        const rows: ReactNode[] = [];
        const seenThreads = new Set<number>();
        for (const { line, side } of anchors) {
            const lineComments = commentsByLine.get(`${line}-${side}`) ?? [];
            for (const thread of groupReviewCommentThreads(lineComments)) {
                if (!isLastLineOfRange(thread.parent, positionMap, line))
                    continue;
                if (seenThreads.has(thread.parent.id)) continue;
                seenThreads.add(thread.parent.id);
                rows.push(
                    <tr key={`thread-${thread.parent.id}`}>
                        <td colSpan={4} className="p-0 dark:bg-zinc-950">
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
                    </tr>,
                );
            }
        }
        return rows;
    };

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

        const oldState = oldNum != null ? buildSideState(oldNum, "LEFT") : null;
        const newState =
            newNum != null ? buildSideState(newNum, "RIGHT") : null;

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

        // Comment anchors: context lines comment on the new side (like
        // unified view); changed lines anchor to their own side.
        const anchors: Array<{ line: number; side: DiffSide }> = [];
        if (isContext && newNum != null) {
            anchors.push({ line: newNum, side: "RIGHT" });
        } else {
            if (oldNum != null) anchors.push({ line: oldNum, side: "LEFT" });
            if (newNum != null) anchors.push({ line: newNum, side: "RIGHT" });
        }

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
                {showComments && renderAttachmentRows(anchors)}
                {isRowActive && (
                    <tr>
                        <td colSpan={4} className="border-border border-t p-2">
                            <DiffLineCommentEditor
                                value={commentBody}
                                onChange={onCommentBodyChange ?? (() => {})}
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
    };

    return buildSplitRows(block).map((row) => renderSplitRow(row));
}

function BlockRows({
    block,
    commentsByLine,
    positionMap,
    multiLineRanges,
    owner,
    repo,
    gap,
    gapKey,
    gapExpansion,
    onGapExpand,
    headSha,
    filename,
    fileHash,
    view = "unified",
    selectedRange,
    onLineSelect,
    onLineMouseDown,
    commentProps,
}: BlockRowsProps) {
    const {
        lines: fileLines,
        isLoading,
        error,
    } = useFileContent({
        owner,
        repo,
        sha: headSha,
        path: filename,
    });

    const gapSize = getDiffGapSize(gap, fileLines?.length);

    // The leading gap (startLine 1) holds the lines *above* the first hunk;
    // it only expands upward (revealing the lines right before the hunk).
    // Middle gaps expand from both ends, toward each other.
    const isLeadingGap = gap?.startLine === 1;
    const revealedTop = isLeadingGap ? 0 : gapExpansion.top;
    const revealedBottom = gapExpansion.bottom;
    const revealedTopClamped = Math.min(revealedTop, gapSize);
    const revealedBottomClamped = Math.min(revealedBottom, gapSize);
    const expandedTotal = revealedTop + revealedBottom;
    const isFullyExpanded = expandedTotal >= gapSize;
    const showUnfoldRow = Boolean(
        gap &&
            headSha &&
            gapSize > 0 &&
            !isFullyExpanded &&
            (expandedTotal === 0 || !isLoading),
    );
    const showExpandedLines =
        Boolean(gap) &&
        gapSize > 0 &&
        expandedTotal > 0 &&
        !isLoading &&
        !error &&
        fileLines != null;

    // expandBottom reveals lines from the bottom of the gap (adjacent to the
    // next hunk, below the unfold row); expandTop reveals lines from the top
    // of the gap (adjacent to the previous hunk, above the unfold row). The
    // leading gap (which sits above the first hunk) only expands from its
    // bottom, backward toward the hunk.
    const expandBottom = () => {
        if (!gap || gapSize <= 0) return;
        onGapExpand?.(gapKey ?? "", {
            top: revealedTop,
            bottom: Math.min(
                revealedBottom + GAP_EXPAND_STEP,
                gapSize - revealedTop,
            ),
        });
    };
    const expandTop = () => {
        if (!gap || gapSize <= 0) return;
        onGapExpand?.(gapKey ?? "", {
            top: Math.min(
                revealedTop + GAP_EXPAND_STEP,
                gapSize - revealedBottom,
            ),
            bottom: revealedBottom,
        });
    };

    // Gap lines are context lines: within a gap, old and new numbering differ
    // by a constant offset (see DiffGap.oldStartLine).
    const gapOldDelta = gap != null ? gap.oldStartLine - gap.startLine : 0;

    const renderGapLine = (lineContent: string, lineNum: number) => (
        <DiffContextRow
            key={`gap-${lineNum}`}
            lineNum={lineNum}
            oldLine={lineNum + gapOldDelta}
            content={lineContent}
            id={fileHash ? `diff-${fileHash}R${lineNum}` : undefined}
            view={view}
            fileHash={fileHash}
            owner={owner}
            repo={repo}
            selectedRange={selectedRange}
            onLineSelect={onLineSelect}
            onLineMouseDown={onLineMouseDown}
            commentsByLine={commentsByLine}
            positionMap={positionMap}
            multiLineRanges={multiLineRanges}
            commentProps={commentProps}
        />
    );

    const infoColSpan = view === "split" ? 3 : 1;

    const leadingUnfoldRow = (
        <tr>
            <td className="d2h-code-linenumber d2h-info">
                <button
                    type="button"
                    onClick={expandBottom}
                    title="Expand lines above"
                    aria-label="Expand lines above"
                    className="absolute inset-0 flex w-full cursor-pointer items-center justify-center text-text-tertiary transition-colors hover:bg-surface-selected hover:text-text-label"
                >
                    <ArrowUpFromLine size={14} />
                </button>
            </td>
            <td className="d2h-info" colSpan={infoColSpan}>
                <div className="d2h-code-line" style={{ userSelect: "text" }}>
                    {revealedBottom === 0 ? block.header : null}
                </div>
            </td>
        </tr>
    );

    const middleUnfoldRow = (
        <tr>
            <td className="d2h-code-linenumber d2h-info">
                <div className="absolute inset-0 flex items-stretch">
                    <button
                        type="button"
                        onClick={expandBottom}
                        title="Expand lines below"
                        aria-label="Expand lines below"
                        className="flex flex-1 cursor-pointer items-center justify-center text-text-tertiary transition-colors hover:bg-surface-selected hover:text-text-label"
                    >
                        <ArrowUpFromLine size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={expandTop}
                        title="Expand lines above"
                        aria-label="Expand lines above"
                        className="flex flex-1 cursor-pointer items-center justify-center border-border border-l text-text-tertiary transition-colors hover:bg-surface-selected hover:text-text-label"
                    >
                        <ArrowDownFromLine size={14} />
                    </button>
                </div>
            </td>
            <td className="d2h-info" colSpan={infoColSpan}>
                <div className="d2h-code-line" style={{ userSelect: "text" }}>
                    {block.header}
                </div>
            </td>
        </tr>
    );

    return (
        <>
            {gap && isLoading && expandedTotal > 0 && (
                <tr>
                    <td className="d2h-code-linenumber d2h-info" />
                    <td className="d2h-info" colSpan={infoColSpan}>
                        <div className="d2h-code-line text-text-muted text-xs">
                            Loading...
                        </div>
                    </td>
                </tr>
            )}
            {/* Leading gaps reveal backward from the hunk: the unfold row
                stays at the top and revealed lines fill in below it. */}
            {isLeadingGap && showUnfoldRow && leadingUnfoldRow}
            {showExpandedLines &&
                gap &&
                isLeadingGap &&
                fileLines
                    .slice(gap.endLine - revealedBottomClamped, gap.endLine)
                    .map((lineContent, idx) =>
                        renderGapLine(
                            lineContent,
                            gap.endLine - revealedBottomClamped + 1 + idx,
                        ),
                    )}
            {/* Middle gaps: top-revealed lines... */}
            {showExpandedLines &&
                gap &&
                !isLeadingGap &&
                !isFullyExpanded &&
                revealedTopClamped > 0 &&
                fileLines
                    .slice(
                        gap.startLine - 1,
                        gap.startLine - 1 + revealedTopClamped,
                    )
                    .map((lineContent, idx) =>
                        renderGapLine(lineContent, gap.startLine + idx),
                    )}
            {/* ...or the whole gap once both ends meet. */}
            {showExpandedLines &&
                gap &&
                !isLeadingGap &&
                isFullyExpanded &&
                fileLines
                    .slice(gap.startLine - 1, gap.endLine)
                    .map((lineContent, idx) =>
                        renderGapLine(lineContent, gap.startLine + idx),
                    )}
            {/* Two-button unfold row sits between the revealed regions. */}
            {!isLeadingGap && showUnfoldRow && middleUnfoldRow}
            {/* Middle gaps: bottom-revealed lines. */}
            {showExpandedLines &&
                gap &&
                !isLeadingGap &&
                !isFullyExpanded &&
                revealedBottomClamped > 0 &&
                fileLines
                    .slice(gap.endLine - revealedBottomClamped, gap.endLine)
                    .map((lineContent, idx) =>
                        renderGapLine(
                            lineContent,
                            gap.endLine - revealedBottomClamped + 1 + idx,
                        ),
                    )}
            {view === "split" ? (
                <SplitBlockRows
                    block={block}
                    commentsByLine={commentsByLine}
                    positionMap={positionMap}
                    multiLineRanges={multiLineRanges}
                    owner={owner}
                    repo={repo}
                    fileHash={fileHash}
                    selectedRange={selectedRange}
                    onLineSelect={onLineSelect}
                    onLineMouseDown={onLineMouseDown}
                    commentProps={commentProps}
                />
            ) : (
                <UnifiedBlockRows
                    block={block}
                    commentsByLine={commentsByLine}
                    positionMap={positionMap}
                    multiLineRanges={multiLineRanges}
                    owner={owner}
                    repo={repo}
                    fileHash={fileHash}
                    selectedRange={selectedRange}
                    onLineSelect={onLineSelect}
                    onLineMouseDown={onLineMouseDown}
                    commentProps={commentProps}
                />
            )}
        </>
    );
}

interface GapRowProps extends DiffRowNavigationProps {
    startLine: number;
    oldStartLine: number;
    expandedCount: number;
    onExpand: (key: string, expansion: GapExpansion) => void;
    gapKey: string;
    owner: string | undefined;
    repo: string | undefined;
    headSha: string | undefined;
    filename: string;
    view: DiffViewMode;
    commentsByLine: Map<string, ReviewComment[]>;
    positionMap: Map<number, DiffAnchor>;
    multiLineRanges: Map<string, string[]>;
    commentProps: DiffRowCommentProps;
}

function GapRow({
    startLine,
    oldStartLine,
    expandedCount,
    onExpand,
    gapKey,
    owner,
    repo,
    headSha,
    filename,
    fileHash,
    view,
    selectedRange,
    onLineSelect,
    onLineMouseDown,
    commentsByLine,
    positionMap,
    multiLineRanges,
    commentProps,
}: GapRowProps) {
    const { lines, isLoading, error } = useFileContent({
        owner,
        repo,
        sha: headSha,
        path: filename,
    });

    const endLine = lines?.length ?? -1;
    const gapSize = endLine - startLine + 1;
    const contentColSpan = view === "split" ? 3 : 1;

    if (expandedCount === 0) {
        if (gapSize <= 0) return null;
        if (!headSha) return null;
        return (
            <tr>
                <td className="d2h-code-linenumber d2h-info">
                    <button
                        type="button"
                        title="Expand lines below"
                        aria-label="Expand lines below"
                        onClick={() =>
                            onExpand(gapKey, {
                                top: Math.min(GAP_EXPAND_STEP, gapSize),
                                bottom: 0,
                            })
                        }
                        className="absolute inset-0 flex w-full cursor-pointer items-center justify-center text-text-tertiary transition-colors hover:bg-surface-selected hover:text-text-label"
                    >
                        <ArrowDownFromLine size={14} />
                    </button>
                </td>
                <td className="d2h-info" colSpan={contentColSpan}>
                    <div className="d2h-code-line" />
                </td>
            </tr>
        );
    }

    if (isLoading) {
        return (
            <tr>
                <td className="d2h-code-linenumber d2h-info" />
                <td className="d2h-info" colSpan={contentColSpan}>
                    <div className="d2h-code-line text-text-muted text-xs">
                        Loading...
                    </div>
                </td>
            </tr>
        );
    }

    if (error || !lines || gapSize <= 0) {
        return null;
    }

    const gapLines = lines.slice(
        startLine - 1,
        startLine - 1 + Math.min(expandedCount, gapSize),
    );

    return (
        <>
            {gapLines.map((lineContent, idx) => {
                const lineNum = startLine + idx;
                return (
                    <DiffContextRow
                        key={`gap-${lineNum}`}
                        lineNum={lineNum}
                        oldLine={oldStartLine + idx}
                        content={lineContent}
                        id={`diff-${fileHash}R${lineNum}`}
                        selectedRange={selectedRange}
                        onLineSelect={onLineSelect}
                        onLineMouseDown={onLineMouseDown}
                        view={view}
                        fileHash={fileHash}
                        owner={owner}
                        repo={repo}
                        commentsByLine={commentsByLine}
                        positionMap={positionMap}
                        multiLineRanges={multiLineRanges}
                        commentProps={commentProps}
                    />
                );
            })}
            {expandedCount < gapSize && (
                <tr>
                    <td className="d2h-code-linenumber d2h-info">
                        <button
                            type="button"
                            title="Expand lines below"
                            aria-label="Expand lines below"
                            onClick={() =>
                                onExpand(gapKey, {
                                    top: Math.min(
                                        expandedCount + GAP_EXPAND_STEP,
                                        gapSize,
                                    ),
                                    bottom: 0,
                                })
                            }
                            className="absolute inset-0 flex w-full cursor-pointer items-center justify-center text-text-tertiary transition-colors hover:bg-surface-selected hover:text-text-label"
                        >
                            <ArrowDownFromLine size={14} />
                        </button>
                    </td>
                    <td className="d2h-info" colSpan={contentColSpan}>
                        <div className="d2h-code-line" />
                    </td>
                </tr>
            )}
        </>
    );
}

interface DiffTableBodyProps {
    items: DiffRenderItem[];
    expandAllContext: boolean;
    expandedGaps: Map<string, GapExpansion>;
    onGapExpand: (key: string, expansion: GapExpansion) => void;
    owner: string | undefined;
    repo: string | undefined;
    headSha: string | undefined;
    filename: string;
    fileHash: string | undefined;
    view: DiffViewMode;
    selectedRange: { startLine: number; endLine: number; side: string } | null;
    onLineSelect: (lineNum: number, side: string, shiftKey: boolean) => void;
    onLineMouseDown: (lineNum: number, side: string) => void;
    commentsByLine: Map<string, ReviewComment[]>;
    positionMap: Map<number, DiffAnchor>;
    multiLineRanges: Map<string, string[]>;
    commentProps: DiffRowCommentProps;
}

function DiffTableBody({
    items,
    expandAllContext,
    expandedGaps,
    onGapExpand,
    owner,
    repo,
    headSha,
    filename,
    fileHash,
    view,
    selectedRange,
    onLineSelect,
    onLineMouseDown,
    commentsByLine,
    positionMap,
    multiLineRanges,
    commentProps,
}: DiffTableBodyProps) {
    return (
        <>
            {items.map((item, idx) => {
                if (item.type === "gap") {
                    if (item.endLine !== -1) return null;
                    const gapKey = `gap-${item.startLine}`;
                    const expandedCount = expandAllContext
                        ? Infinity
                        : (expandedGaps.get(gapKey)?.top ?? 0);
                    return (
                        <GapRow
                            key={gapKey}
                            startLine={item.startLine}
                            oldStartLine={item.oldStartLine}
                            expandedCount={expandedCount}
                            onExpand={onGapExpand}
                            gapKey={gapKey}
                            owner={owner}
                            repo={repo}
                            headSha={headSha}
                            filename={filename}
                            fileHash={fileHash}
                            view={view}
                            selectedRange={selectedRange}
                            onLineSelect={onLineSelect}
                            onLineMouseDown={onLineMouseDown}
                            commentsByLine={commentsByLine}
                            positionMap={positionMap}
                            multiLineRanges={multiLineRanges}
                            commentProps={commentProps}
                        />
                    );
                }
                const previous = idx > 0 ? items[idx - 1] : null;
                const previousGap = previous?.type === "gap" ? previous : null;
                const gap =
                    previousGap && previousGap.endLine !== -1
                        ? {
                              startLine: previousGap.startLine,
                              endLine: previousGap.endLine,
                              oldStartLine: previousGap.oldStartLine,
                          }
                        : undefined;
                const gapKey = gap ? `gap-${gap.startLine}` : undefined;
                const gapExpansion = gapKey
                    ? expandAllContext
                        ? { top: Infinity, bottom: Infinity }
                        : (expandedGaps.get(gapKey) ?? { top: 0, bottom: 0 })
                    : { top: 0, bottom: 0 };
                return (
                    <BlockRows
                        key={`block-${item.block.newStartLine}`}
                        block={item.block}
                        gap={gap}
                        gapKey={gapKey}
                        gapExpansion={gapExpansion}
                        onGapExpand={onGapExpand}
                        headSha={headSha}
                        filename={filename}
                        fileHash={fileHash}
                        view={view}
                        selectedRange={selectedRange}
                        onLineSelect={onLineSelect}
                        onLineMouseDown={onLineMouseDown}
                        commentsByLine={commentsByLine}
                        positionMap={positionMap}
                        multiLineRanges={multiLineRanges}
                        owner={owner}
                        repo={repo}
                        commentProps={commentProps}
                    />
                );
            })}
        </>
    );
}

// Total height of the sticky elements pinned to the top of the viewport that
// horizontally overlap the target line. On the files changed page that is the
// "Files Changed" bar (sticky top-0) plus the file's own sticky header
// (sticky top-[64px]); elements in other columns (e.g. the left sidebar) never
// overlap the diff lines and are excluded.
function getStickyTopHeight(target: HTMLElement): number {
    const targetRect = target.getBoundingClientRect();
    const targetCenterX = targetRect.left + targetRect.width / 2;
    let offset = 0;
    for (const el of document.querySelectorAll<HTMLElement>("*")) {
        const style = getComputedStyle(el);
        if (style.position !== "sticky") continue;
        const stickyTop = parseFloat(style.top);
        if (!Number.isFinite(stickyTop) || stickyTop < 0) continue;
        const rect = el.getBoundingClientRect();
        if (rect.height <= 0 || rect.bottom <= 0) continue;
        if (rect.left > targetCenterX || rect.right < targetCenterX) continue;
        offset = Math.max(offset, stickyTop + rect.height);
    }
    return offset;
}
