"use client";

import type { ColorSchemeType, DiffBlock } from "diff2html/lib/types";
import "diff2html/bundles/css/diff2html.min.css";
import { Plus, UnfoldVertical } from "lucide-react";
import { useTheme } from "next-themes";
import {
    Fragment,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import type { PullRequestPermissionContext } from "~/app/gh/[owner]/[repo]/pull/[number]/permissions-utils";
import { useFileContent } from "~/hooks/use-file-content";
import type { ReviewComment } from "~/server/github";
import { filenameHash } from "~/utils/filename-hash";
import { getDiffGapSize } from "./diff/diff-block-rows";
import { DiffContextRow } from "./diff/diff-context-row";
import { DiffLineCommentEditor } from "./diff/diff-line-comment-editor";
import { DiffLineRow } from "./diff/diff-line-row";
import { DiffTable } from "./diff/diff-table";
import {
    buildDiffPositionMap,
    createDiffRenderItems,
    getDiffLanguage,
    parseDiffPatch,
    resolveDiffCommentAnchor,
} from "./diff/model";
import type {
    DiffAnchor,
    DiffCommentTarget,
    DiffGap,
    DiffRenderItem,
} from "./diff/types";
import { useDiffCommentSelection } from "./diff/use-diff-comment-selection";
import { useDiffHashNavigation } from "./diff/use-diff-hash-navigation";
import { useDiffLineSelection } from "./diff/use-diff-line-selection";
import { useDiffSyntaxHighlighting } from "./diff/use-diff-syntax-highlighting";
import { InlineCommentThread } from "./inline-comment-thread";
import type { FooterAction } from "./markdown/markdown-editor";
import { groupReviewCommentThreads } from "./review-comment-threads";

// Breathing room between the sticky bars and the line a permalink scrolls to.
const SCROLL_TARGET_PADDING = 12;

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

export type { DiffCommentTarget } from "./diff/types";

interface DiffViewProps {
    patch: string;
    filename: string;
    headSha?: string;
    expandAllContext?: boolean;
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

/** Comment-related props threaded through the diff table rows. */
interface DiffRowCommentProps {
    activeComment: DiffCommentTarget | null;
    onStartComment: ((ac: DiffCommentTarget | null) => void) | undefined;
    pullNumber: number | string | undefined;
    commentBody: string;
    onCommentBodyChange: ((body: string) => void) | undefined;
    footerActions?: FooterAction[];
    commentPending: boolean;
    commentError: boolean;
    onCancelComment: (() => void) | undefined;
    showComments: boolean;
    showCommentButton: boolean;
    commentDragRange: {
        startLine: number;
        endLine: number;
        side: "LEFT" | "RIGHT";
    } | null;
    onCommentDragStart?: (line: number, side: "LEFT" | "RIGHT") => void;
    pendingReviewId?: number | null;
    permissionContext: PullRequestPermissionContext;
}

/** Gap/navigation props shared by the diff table row components. */
interface DiffRowNavigationProps {
    gapKey?: string;
    isGapExpanded?: boolean;
    onGapExpand?: (key: string) => void;
    headSha?: string;
    filename?: string;
    fileHash?: string;
    selectedRange?: {
        startLine: number;
        endLine: number;
        side: string;
    } | null;
    onLineSelect?: (lineNum: number, side: string, shiftKey: boolean) => void;
    onLineMouseDown?: (lineNum: number, side: string) => void;
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
}: DiffViewProps & DiffCommentProps) {
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

    const [expandedGapKeys, setExpandedGapKeys] = useState<Set<string>>(
        () => new Set(),
    );

    const handleGapExpand = useCallback((key: string) => {
        setExpandedGapKeys((prev) => {
            const next = new Set(prev);
            next.add(key);
            return next;
        });
    }, []);

    useEffect(() => {
        if (!expandAllContext) {
            setExpandedGapKeys(new Set());
        }
    }, [expandAllContext]);
    useDiffSyntaxHighlighting({
        diffRef,
        language,
        enabled: Boolean(parsed),
        rerenderKey: `${expandedGapKeys.size}-${expandAllContext}`,
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
        setExpandedGapKeys,
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
        >
            <DiffTableBody
                items={renderItems}
                expandAllContext={expandAllContext}
                expandedGapKeys={expandedGapKeys}
                onGapExpand={handleGapExpand}
                owner={owner}
                repo={repo}
                headSha={headSha}
                filename={filename}
                fileHash={fileHash}
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

interface BlockRowsProps extends DiffRowNavigationProps {
    block: DiffBlock;
    commentsByLine: Map<string, ReviewComment[]>;
    positionMap: Map<number, DiffAnchor>;
    multiLineRanges: Map<string, string[]>;
    owner: string | undefined;
    repo: string | undefined;
    hideHeader?: boolean;
    gap?: DiffGap;
    commentProps: DiffRowCommentProps;
}

function BlockRows({
    block,
    commentsByLine,
    positionMap,
    multiLineRanges,
    owner,
    repo,
    hideHeader,
    gap,
    gapKey,
    isGapExpanded,
    onGapExpand,
    headSha,
    filename,
    fileHash,
    selectedRange,
    onLineSelect,
    onLineMouseDown,
    commentProps,
}: BlockRowsProps) {
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
    const gapEnd =
        gap?.endLine === -1 ? (fileLines?.length ?? -1) : (gap?.endLine ?? -1);

    const handleLineClick = useCallback(
        (lineNum: number, side: string, e: React.MouseEvent) => {
            onLineSelect?.(lineNum, side, e.shiftKey);
        },
        [onLineSelect],
    );

    return (
        <>
            {isGapExpanded && gap && isLoading && (
                <tr>
                    <td className="d2h-code-linenumber d2h-info" />
                    <td className="d2h-info">
                        <div className="d2h-code-line text-text-muted text-xs">
                            Loading...
                        </div>
                    </td>
                </tr>
            )}
            {isGapExpanded &&
                gap &&
                !isLoading &&
                !error &&
                fileLines &&
                gapSize > 0 &&
                fileLines
                    .slice(gap.startLine - 1, gapEnd)
                    .map((lineContent, idx) => {
                        const lineNum = gap.startLine + idx;
                        return (
                            <DiffContextRow
                                key={`gap-${lineNum}`}
                                lineNum={lineNum}
                                content={lineContent}
                                id={
                                    fileHash
                                        ? `diff-${fileHash}R${lineNum}`
                                        : undefined
                                }
                            />
                        );
                    })}
            {!hideHeader && headSha && (
                <tr
                    className={
                        gap && !isGapExpanded && gapSize > 0
                            ? "cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30"
                            : ""
                    }
                    onClick={() => {
                        if (gap && !isGapExpanded && gapSize > 0) {
                            onGapExpand?.(gapKey ?? "");
                        }
                    }}
                >
                    <td className="d2h-code-linenumber d2h-info">
                        {gap && !isGapExpanded && gapSize > 0 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <UnfoldVertical
                                    size={14}
                                    className="text-text-tertiary"
                                />
                            </div>
                        )}
                    </td>
                    <td className="d2h-info">
                        <div className="d2h-code-line">{block.header}</div>
                    </td>
                </tr>
            )}
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

                const isLastLineOfRange = (c: ReviewComment) =>
                    (resolveDiffCommentAnchor(c, positionMap)?.line ?? 0) ===
                    commentLine;

                const lineId = fileHash
                    ? `diff-${fileHash}${newNum != null ? `R${newNum}` : `L${oldNum}`}`
                    : undefined;
                const lineNum = newNum ?? oldNum ?? 0;
                const lineSide = type === "delete" ? "LEFT" : "RIGHT";
                const isHighlighted =
                    selectedRange != null &&
                    selectedRange.side === lineSide &&
                    commentLine >= selectedRange.startLine &&
                    commentLine <= selectedRange.endLine;

                return (
                    <Fragment key={`${oldNum}-${newNum}-${line.content}`}>
                        <DiffLineRow
                            className={`group ${isHighlighted ? "line-highlighted" : ""}`}
                            id={lineId}
                        >
                            <td
                                className={`d2h-code-linenumber ${typeClass} ${showRangeIndicator ? "border-blue-400 border-l-4" : ""}`}
                                onMouseDown={() =>
                                    onLineMouseDown?.(lineNum, lineSide)
                                }
                                onClick={(e) => {
                                    const num = newNum ?? oldNum ?? 0;
                                    handleLineClick(
                                        num,
                                        type === "delete" ? "LEFT" : "RIGHT",
                                        e,
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
                                    isLastLineOfRange(thread.parent),
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

interface GapRowProps extends DiffRowNavigationProps {
    startLine: number;
    isExpanded: boolean;
    onExpand: (key: string) => void;
    gapKey: string;
    owner: string | undefined;
    repo: string | undefined;
    headSha: string | undefined;
    filename: string;
}

function GapRow({
    startLine,
    isExpanded,
    onExpand,
    gapKey,
    owner,
    repo,
    headSha,
    filename,
    fileHash,
    selectedRange,
    onLineSelect,
    onLineMouseDown,
}: GapRowProps) {
    const { lines, isLoading, error } = useFileContent({
        owner,
        repo,
        sha: headSha,
        path: filename,
    });

    const endLine = lines?.length ?? -1;
    const gapSize = endLine - startLine + 1;

    const isGapHighlighted =
        selectedRange != null && selectedRange.side === "RIGHT";

    if (!isExpanded) {
        if (gapSize <= 0) return null;
        if (!headSha) return null;
        return (
            <tr
                className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30"
                onClick={() => onExpand(gapKey)}
            >
                <td className="d2h-code-linenumber d2h-info">
                    <div className="absolute inset-0 flex items-center justify-center">
                        <UnfoldVertical
                            size={14}
                            className="text-text-tertiary"
                        />
                    </div>
                </td>
                <td className="d2h-info">
                    <div className="d2h-code-line" />
                </td>
            </tr>
        );
    }

    if (isLoading) {
        return (
            <tr>
                <td className="d2h-code-linenumber d2h-info" />
                <td className="d2h-info">
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

    const gapLines = lines.slice(startLine - 1, endLine);

    return (
        <>
            {gapLines.map((lineContent, idx) => {
                const lineNum = startLine + idx;
                const lineHighlighted =
                    selectedRange != null &&
                    isGapHighlighted &&
                    lineNum >= selectedRange.startLine &&
                    lineNum <= selectedRange.endLine;
                return (
                    <DiffContextRow
                        key={`gap-${lineNum}`}
                        lineNum={lineNum}
                        content={lineContent}
                        id={`diff-${fileHash}R${lineNum}`}
                        highlighted={lineHighlighted}
                        onLineSelect={onLineSelect}
                        onLineMouseDown={onLineMouseDown}
                    />
                );
            })}
        </>
    );
}

interface DiffTableBodyProps {
    items: DiffRenderItem[];
    expandAllContext: boolean;
    expandedGapKeys: Set<string>;
    onGapExpand: (key: string) => void;
    owner: string | undefined;
    repo: string | undefined;
    headSha: string | undefined;
    filename: string;
    fileHash: string | undefined;
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
    expandedGapKeys,
    onGapExpand,
    owner,
    repo,
    headSha,
    filename,
    fileHash,
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
                    const isExpanded =
                        expandAllContext || expandedGapKeys.has(gapKey);
                    return (
                        <GapRow
                            key={gapKey}
                            startLine={item.startLine}
                            isExpanded={isExpanded}
                            onExpand={onGapExpand}
                            gapKey={gapKey}
                            owner={owner}
                            repo={repo}
                            headSha={headSha}
                            filename={filename}
                            fileHash={fileHash}
                            selectedRange={selectedRange}
                            onLineSelect={onLineSelect}
                            onLineMouseDown={onLineMouseDown}
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
                          }
                        : undefined;
                const gapKey = gap ? `gap-${gap.startLine}` : undefined;
                const isGapExpanded =
                    gapKey !== undefined &&
                    (expandAllContext || expandedGapKeys.has(gapKey));
                return (
                    <BlockRows
                        key={`block-${item.block.newStartLine}`}
                        block={item.block}
                        hideHeader={isGapExpanded}
                        gap={gap}
                        gapKey={gapKey}
                        isGapExpanded={isGapExpanded}
                        onGapExpand={onGapExpand}
                        headSha={headSha}
                        filename={filename}
                        fileHash={fileHash}
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
