"use client";

import { defaultDiff2HtmlConfig, parse } from "diff2html";
import type { ColorSchemeType } from "diff2html/lib/types";
import "diff2html/bundles/css/diff2html.min.css";
import type { DiffBlock } from "diff2html/lib/types";
import hljs from "highlight.js";
import { SquarePlus, UnfoldVertical } from "lucide-react";
import { useTheme } from "next-themes";
import {
    Fragment,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useFileContent } from "~/hooks/useFileContent";
import type { ReviewComment } from "~/server/github";
import { filenameHash } from "~/utils/filename-hash";
import { InlineCommentThread } from "./InlineCommentThread";
import type { FooterAction } from "./markdown/MarkdownEditor";
import { MarkdownEditor } from "./markdown/MarkdownEditor";

export type ActiveComment =
    | {
          type: "line";
          line: number;
          side: "LEFT" | "RIGHT";
          startLine?: number;
          startSide?: "LEFT" | "RIGHT";
      }
    | { type: "file" };

interface DiffViewProps {
    patch: string;
    filename: string;
    comments?: ReviewComment[];
    showComments?: boolean;
    showCommentButton?: boolean;
    activeComment?: ActiveComment | null;
    onStartComment?: (ac: ActiveComment | null) => void;
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
    headSha?: string;
    expandAllContext?: boolean;
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
    headSha,
    expandAllContext = false,
}: DiffViewProps) {
    const { resolvedTheme } = useTheme();

    const parsed = useMemo(() => {
        if (!patch) return null;
        const normalizedDiff = patch.startsWith("---")
            ? patch
            : `--- a/${filename}\n+++ b/${filename}\n${patch}`;
        const files = parse(normalizedDiff, {
            ...defaultDiff2HtmlConfig,
            colorScheme: (resolvedTheme === "light" || resolvedTheme === "dark"
                ? resolvedTheme
                : defaultDiff2HtmlConfig.colorScheme) as ColorSchemeType,
        });
        return files[0] ?? null;
    }, [patch, filename, resolvedTheme]);

    const diffRef = useRef<HTMLDivElement>(null);

    const language = useMemo(() => {
        const ext = filename.split(".").pop()?.toLowerCase();
        if (!ext) return null;
        const langMap: Record<string, string> = {
            tsx: "typescript",
            jsx: "javascript",
            mjs: "javascript",
            cjs: "javascript",
            mts: "typescript",
            cts: "typescript",
            vue: "html",
            svelte: "html",
        };
        const lang = langMap[ext] ?? ext;
        try {
            return hljs.getLanguage(lang) ? lang : null;
        } catch {
            return null;
        }
    }, [filename]);

    const fileHash = useMemo(() => filenameHash(filename), [filename]);

    const [selectedRange, setSelectedRange] = useState<{
        startLine: number;
        endLine: number;
        side: string;
    } | null>(null);
    const mouseAnchorRef = useRef<{ line: number; side: string } | null>(null);
    const isDragging = useRef(false);
    const dragStartRef = useRef<{ line: number; side: string } | null>(null);

    const [commentDragRange, setCommentDragRange] = useState<{
        startLine: number;
        endLine: number;
        side: "LEFT" | "RIGHT";
    } | null>(null);
    const commentDragAnchor = useRef<{
        line: number;
        side: "LEFT" | "RIGHT";
    } | null>(null);
    const commentDragInProgress = useRef(false);

    const updateSelection = useCallback(
        (startLine: number, endLine: number, side: string) => {
            const lo = Math.min(startLine, endLine);
            const hi = Math.max(startLine, endLine);
            setSelectedRange({ startLine: lo, endLine: hi, side });
        },
        [],
    );

    const commitRangeUrl = useCallback(
        (startLine: number, endLine: number, side: string) => {
            const lo = Math.min(startLine, endLine);
            const hi = Math.max(startLine, endLine);
            const url = `${window.location.pathname}#diff-${fileHash}${side === "RIGHT" ? "R" : "L"}${lo}-${side === "RIGHT" ? "R" : "L"}${hi}`;
            history.replaceState(null, "", url);
        },
        [fileHash],
    );

    const commitSingleUrl = useCallback(
        (lineNum: number, side: string) => {
            const url = `${window.location.pathname}#diff-${fileHash}${side === "RIGHT" ? "R" : "L"}${lineNum}`;
            history.replaceState(null, "", url);
        },
        [fileHash],
    );

    const handleLineSelect = useCallback(
        (lineNum: number, side: string, shiftKey: boolean) => {
            if (shiftKey && mouseAnchorRef.current) {
                const start = Math.min(mouseAnchorRef.current.line, lineNum);
                const end = Math.max(mouseAnchorRef.current.line, lineNum);
                commitRangeUrl(start, end, side);
                updateSelection(start, end, side);
                mouseAnchorRef.current = null;
            } else {
                commitSingleUrl(lineNum, side);
                updateSelection(lineNum, lineNum, side);
                mouseAnchorRef.current = { line: lineNum, side };
            }
        },
        [commitRangeUrl, commitSingleUrl, updateSelection],
    );

    const handleLineMouseDown = useCallback(
        (lineNum: number, side: string) => {
            if (activeComment?.type === "line" && activeComment.side === side) {
                commentDragInProgress.current = true;
                commentDragAnchor.current = {
                    line: activeComment.line,
                    side: activeComment.side,
                };
                const startLine = Math.min(activeComment.line, lineNum);
                const endLine = Math.max(activeComment.line, lineNum);
                setCommentDragRange({ startLine, endLine, side });
                return;
            }
            isDragging.current = true;
            dragStartRef.current = { line: lineNum, side };
            updateSelection(lineNum, lineNum, side);
        },
        [activeComment, updateSelection],
    );

    const handleCommentDragStart = useCallback(
        (line: number, side: "LEFT" | "RIGHT") => {
            commentDragInProgress.current = true;
            commentDragAnchor.current = { line, side };
            setCommentDragRange({ startLine: line, endLine: line, side });
            updateSelection(line, line, side);
        },
        [updateSelection],
    );

    const handleTableMouseOver = useCallback(
        (e: React.MouseEvent) => {
            if (commentDragInProgress.current && commentDragAnchor.current) {
                const tr = (e.target as HTMLElement).closest(
                    'tr[id^="diff-"]',
                ) as HTMLElement | null;
                if (!tr) return;
                const lineMatch = tr.id.match(/(\d+)$/);
                if (!lineMatch) return;
                const lineNum = parseInt(lineMatch[1] ?? "0", 10);
                const anchor = commentDragAnchor.current;
                const startLine = Math.min(anchor.line, lineNum);
                const endLine = Math.max(anchor.line, lineNum);
                setCommentDragRange({ startLine, endLine, side: anchor.side });
                updateSelection(anchor.line, lineNum, anchor.side);
                return;
            }
            if (!isDragging.current || !dragStartRef.current) return;
            const tr = (e.target as HTMLElement).closest(
                'tr[id^="diff-"]',
            ) as HTMLElement | null;
            if (!tr) return;
            const lineMatch = tr.id.match(/(\d+)$/);
            if (!lineMatch) return;
            const lineNum = parseInt(lineMatch[1] ?? "0", 10);
            const anchor = dragStartRef.current;
            if (!anchor) return;
            updateSelection(anchor.line, lineNum, anchor.side);
        },
        [updateSelection],
    );

    useEffect(() => {
        const handleMouseUp = () => {
            if (commentDragInProgress.current) {
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
                return;
            }
            if (!isDragging.current) return;
            isDragging.current = false;
            if (dragStartRef.current) {
                const anchor = dragStartRef.current;
                const range = selectedRange;
                if (range && range.startLine !== range.endLine) {
                    commitRangeUrl(range.startLine, range.endLine, range.side);
                } else {
                    commitSingleUrl(anchor.line, anchor.side);
                }
            }
            dragStartRef.current = null;
        };
        document.addEventListener("mouseup", handleMouseUp);
        return () => document.removeEventListener("mouseup", handleMouseUp);
    }, [
        selectedRange,
        commitRangeUrl,
        commitSingleUrl,
        commentDragRange,
        onStartComment,
    ]);

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

    useEffect(() => {
        if (!diffRef.current || !language || !parsed) return;
        const lines =
            diffRef.current.querySelectorAll<HTMLElement>(".d2h-code-line-ctn");
        lines.forEach((el) => {
            const text = el.textContent;
            if (!text) return;
            const result = hljs.highlight(text, { language });
            el.innerHTML = result.value;
        });
        // Re-run when gap expansions add new .d2h-code-line-ctn elements to the DOM
        void expandedGapKeys;
        void expandAllContext;
    }, [language, parsed, expandedGapKeys, expandAllContext]);

    const commentsByLine = useMemo(() => {
        const map = new Map<string, ReviewComment[]>();
        for (const comment of comments) {
            const side = comment.side ?? "RIGHT";
            const endLine = comment.line ?? comment.position ?? 0;
            const startLine = comment.start_line ?? endLine;
            for (let line = startLine; line <= endLine; line++) {
                const key = `${line}-${side}`;
                const existing = map.get(key) ?? [];
                existing.push(comment);
                map.set(key, existing);
            }
        }
        return map;
    }, [comments]);

    const multiLineRanges = useMemo(() => {
        const ranges = new Map<string, string[]>();
        for (const comment of comments) {
            const side = comment.side ?? "RIGHT";
            const endLine = comment.line ?? comment.position ?? 0;
            const startLine = comment.start_line;
            if (startLine == null || startLine === endLine) continue;
            for (let line = startLine; line <= endLine; line++) {
                const key = `${line}-${side}`;
                const existing = ranges.get(key) ?? [];
                const rangeId = `${comment.id}`;
                if (!existing.includes(rangeId)) {
                    existing.push(rangeId);
                    ranges.set(key, existing);
                }
            }
        }
        return ranges;
    }, [comments]);

    const renderItems = useMemo(() => {
        if (!parsed?.blocks) return [];
        const items: Array<
            { type: "block"; block: DiffBlock } | ({ type: "gap" } & Gap)
        > = [];

        for (let i = 0; i < parsed.blocks.length; i++) {
            const block = parsed.blocks[i];
            if (!block) continue;

            if (i === 0 && block.newStartLine > 1) {
                items.push({
                    type: "gap",
                    startLine: 1,
                    endLine: block.newStartLine - 1,
                });
            }

            if (i > 0) {
                const prevBlock = parsed.blocks[i - 1];
                if (!prevBlock) continue;
                const g = computeBetweenGap(prevBlock, block);
                if (g) {
                    items.push({ type: "gap", ...g });
                }
            }

            items.push({ type: "block", block });

            if (i === parsed.blocks.length - 1) {
                const leading = getLastNewLine(block) + 1;
                items.push({
                    type: "gap",
                    startLine: leading,
                    endLine: -1,
                });
            }
        }

        return items;
    }, [parsed]);

    const renderItemsRef = useRef(renderItems);
    renderItemsRef.current = renderItems;

    // Scroll to line targeted by URL hash; expand only the gap containing the target
    useEffect(() => {
        if (!diffRef.current) return;
        const hash = window.location.hash;
        if (!hash?.startsWith(`#diff-${fileHash}`)) return;
        const targetMatch = hash.match(/^#(diff-[0-9a-f]+[RL]\d+)/);
        const targetId = targetMatch?.[1];
        if (!targetId) return;

        const lineMatch = hash.match(/[RL](\d+)/g);
        const startLine = lineMatch
            ? parseInt(lineMatch[0]?.slice(1) ?? "0", 10)
            : 0;
        const endLine = lineMatch?.[1]
            ? parseInt(lineMatch[1].slice(1), 10)
            : startLine;
        const side = hash.includes("R") ? "RIGHT" : "LEFT";

        // Expand only the gap containing the target line, not all gaps
        const targetLine = startLine;
        const items = renderItemsRef.current;
        if (items) {
            for (const item of items) {
                if (item.type === "gap") {
                    const gapStart = item.startLine;
                    const gapEnd =
                        item.endLine === -1 ? Infinity : item.endLine;
                    if (targetLine >= gapStart && targetLine <= gapEnd) {
                        const gapKey = `gap-${gapStart}`;
                        setExpandedGapKeys((prev) => {
                            if (prev.has(gapKey)) return prev;
                            const next = new Set(prev);
                            next.add(gapKey);
                            return next;
                        });
                        break;
                    }
                }
            }
        }

        const scrollToLine = () => {
            const el = document.getElementById(targetId);
            if (el) {
                const rect = el.getBoundingClientRect();
                window.scrollTo({
                    top: rect.top + window.scrollY - window.innerHeight / 2,
                    behavior: "smooth",
                });
                setSelectedRange({ startLine, endLine, side });
                return true;
            }
            return false;
        };

        if (scrollToLine()) return;

        let rafId: number;
        const poll = () => {
            if (scrollToLine()) return;
            rafId = requestAnimationFrame(poll);
        };
        rafId = requestAnimationFrame(poll);

        const observer = new MutationObserver(() => {
            if (scrollToLine()) {
                observer.disconnect();
                cancelAnimationFrame(rafId);
            }
        });
        observer.observe(diffRef.current, {
            childList: true,
            subtree: true,
        });

        const timeout = setTimeout(() => {
            observer.disconnect();
            cancelAnimationFrame(rafId);
        }, 15000);

        return () => {
            observer.disconnect();
            cancelAnimationFrame(rafId);
            clearTimeout(timeout);
        };
    }, [fileHash]);

    if (!parsed) {
        return null;
    }

    return (
        <div className="overflow-x-auto">
            <style>{`
                tr.line-highlighted td {
                    background-color: rgba(251, 146, 60, 0.2) !important;
                }
                .d2h-code-line {
                    white-space: pre-wrap;
                }
                .d2h-code-line-ctn {
                    white-space: pre-wrap;
                }
                .d2h-ins,
                .d2h-del,
                .d2h-cntx {
                    word-break: break-all;
                }
            `}</style>
            <div
                className={`d2h-wrapper ${resolvedTheme === "light" ? "d2h-light-color-scheme" : "d2h-dark-color-scheme"}`}
                ref={diffRef}
            >
                <table className="d2h-diff-table relative">
                    <tbody
                        className="d2h-diff-tbody"
                        onMouseOver={handleTableMouseOver}
                        onFocus={() => {}}
                    >
                        {renderItems.map((item, idx) => {
                            if (item.type === "gap") {
                                if (item.endLine !== -1) {
                                    // Leading/between gaps handled via next block
                                    return null;
                                }
                                // Trailing gap: render standalone expandable row
                                const gapKey = `gap-${item.startLine}`;
                                const isExpanded =
                                    expandAllContext ||
                                    expandedGapKeys.has(gapKey);
                                return (
                                    <GapRow
                                        key={gapKey}
                                        startLine={item.startLine}
                                        isExpanded={isExpanded}
                                        onExpand={handleGapExpand}
                                        gapKey={gapKey}
                                        owner={owner}
                                        repo={repo}
                                        headSha={headSha}
                                        filename={filename}
                                        fileHash={fileHash}
                                        selectedRange={selectedRange}
                                        onLineSelect={handleLineSelect}
                                        onLineMouseDown={handleLineMouseDown}
                                    />
                                );
                            }

                            const prevItem =
                                idx > 0 ? renderItems[idx - 1] : null;
                            const prevGap =
                                prevItem?.type === "gap" ? prevItem : null;
                            // Only pass gap info if it's not a trailing gap (handled separately)
                            const prevGapForBlock: Gap | undefined =
                                prevGap && prevGap.endLine !== -1
                                    ? {
                                          startLine: prevGap.startLine,
                                          endLine: prevGap.endLine,
                                      }
                                    : undefined;
                            const prevGapKey = prevGapForBlock
                                ? `gap-${prevGapForBlock.startLine}`
                                : undefined;
                            const isGapExpanded =
                                prevGapForBlock !== null &&
                                prevGapKey !== undefined &&
                                (expandAllContext ||
                                    expandedGapKeys.has(prevGapKey));

                            return (
                                <BlockRows
                                    key={`block-${item.block.newStartLine}`}
                                    block={item.block}
                                    hideHeader={isGapExpanded}
                                    gap={prevGapForBlock}
                                    gapKey={prevGapKey}
                                    isGapExpanded={isGapExpanded}
                                    onGapExpand={handleGapExpand}
                                    headSha={headSha}
                                    filename={filename}
                                    fileHash={fileHash}
                                    selectedRange={selectedRange}
                                    onLineSelect={handleLineSelect}
                                    onLineMouseDown={handleLineMouseDown}
                                    commentsByLine={commentsByLine}
                                    multiLineRanges={multiLineRanges}
                                    activeComment={activeComment}
                                    onStartComment={onStartComment}
                                    owner={owner}
                                    repo={repo}
                                    pullNumber={pullNumber}
                                    commentBody={commentBody}
                                    onCommentBodyChange={onCommentBodyChange}
                                    footerActions={footerActions}
                                    commentPending={commentPending}
                                    commentError={commentError}
                                    onCancelComment={onCancelComment}
                                    showComments={showComments}
                                    showCommentButton={showCommentButton}
                                    commentDragRange={commentDragRange}
                                    onCommentDragStart={handleCommentDragStart}
                                    pendingReviewId={pendingReviewId}
                                />
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

type Gap = { startLine: number; endLine: number };

function getLastNewLine(block: DiffBlock): number {
    let last = block.newStartLine;
    for (const line of block.lines) {
        if (line.newNumber !== undefined) {
            last = line.newNumber;
        }
    }
    return last;
}

function computeBetweenGap(
    prevBlock: DiffBlock,
    curBlock: DiffBlock,
): Gap | null {
    const prevLastNew = getLastNewLine(prevBlock);
    const gapStart = prevLastNew + 1;
    const gapEnd = curBlock.newStartLine - 1;
    if (gapStart <= gapEnd) {
        return { startLine: gapStart, endLine: gapEnd };
    }
    return null;
}

export function groupThreads(
    comments: ReviewComment[],
): Array<{ parent: ReviewComment; replies: ReviewComment[] }> {
    const threads = new Map<number, ReviewComment[]>();
    for (const comment of comments) {
        const rootId = comment.in_reply_to_id ?? comment.id;
        const existing = threads.get(rootId) ?? [];
        existing.push(comment);
        threads.set(rootId, existing);
    }
    return Array.from(threads.entries()).map(([, group]) => ({
        parent: group[0] as ReviewComment,
        replies: group.slice(1),
    }));
}

interface BlockRowsProps {
    block: NonNullable<ReturnType<typeof parse>>[number]["blocks"][number];
    commentsByLine: Map<string, ReviewComment[]>;
    multiLineRanges: Map<string, string[]>;
    activeComment: ActiveComment | null;
    onStartComment: ((ac: ActiveComment | null) => void) | undefined;
    owner: string | undefined;
    repo: string | undefined;
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
    hideHeader?: boolean;
    gap?: Gap;
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

function BlockRows({
    block,
    commentsByLine,
    multiLineRanges,
    activeComment,
    onStartComment,
    owner,
    repo,
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
}: BlockRowsProps) {
    const {
        lines: fileLines,
        isLoading,
        error,
    } = useFileContent({
        owner: owner ?? "",
        repo: repo ?? "",
        sha: headSha ?? "",
        path: filename ?? "",
    });

    const gapEnd =
        gap?.endLine === -1 ? (fileLines?.length ?? -1) : (gap?.endLine ?? -1);
    const gapSize = gap ? gapEnd - gap.startLine + 1 : 0;

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
                        <div className="d2h-code-line text-gray-400 text-xs">
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
                            <tr key={`gap-${lineNum}`}>
                                <td className="d2h-code-linenumber d2h-cntx">
                                    <div className="absolute">
                                        <div className="line-num1">
                                            {lineNum}
                                        </div>
                                        <div className="line-num2">
                                            {lineNum}
                                        </div>
                                    </div>
                                </td>
                                <td className="d2h-cntx">
                                    <div
                                        className="d2h-code-line"
                                        style={{ display: "flex" }}
                                    >
                                        <span className="d2h-code-line-ctn">
                                            {lineContent || <br />}
                                        </span>
                                    </div>
                                </td>
                            </tr>
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
                                    className="text-gray-500 dark:text-gray-400"
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
                    (c.line ?? c.position ?? 0) === commentLine;

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
                    <Fragment
                        key={`${oldNum ?? ""}-${newNum ?? ""}-${line.content}`}
                    >
                        <tr
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
                                        <SquarePlus
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
                                    style={{ display: "flex" }}
                                >
                                    <span className="d2h-code-line-ctn">
                                        {content || <br />}
                                    </span>
                                </div>
                            </td>
                        </tr>
                        {showComments &&
                            hasComments &&
                            groupThreads(lineComments)
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
                                                owner={owner ?? ""}
                                                repo={repo ?? ""}
                                                number={Number(pullNumber ?? 0)}
                                                pendingReviewId={
                                                    pendingReviewId
                                                }
                                            />
                                        </td>
                                    </tr>
                                ))}
                        {isActive && (
                            <tr>
                                <td
                                    colSpan={2}
                                    className="border-gray-200 border-t p-2 dark:border-gray-700"
                                >
                                    <MarkdownEditor
                                        autoFocus
                                        disabled={commentPending}
                                        onChange={
                                            onCommentBodyChange ?? (() => {})
                                        }
                                        onCancel={onCancelComment ?? (() => {})}
                                        placeholder="Add a comment..."
                                        value={commentBody}
                                        owner={owner ?? ""}
                                        repo={repo ?? ""}
                                        footerActions={footerActions}
                                    />
                                    {commentError && (
                                        <p className="mt-1 text-red-600 text-xs">
                                            Failed to post comment. Please try
                                            again.
                                        </p>
                                    )}
                                </td>
                            </tr>
                        )}
                    </Fragment>
                );
            })}
        </>
    );
}

interface GapRowProps {
    startLine: number;
    isExpanded: boolean;
    onExpand: (key: string) => void;
    gapKey: string;
    owner: string | undefined;
    repo: string | undefined;
    headSha: string | undefined;
    filename: string;
    fileHash?: string;
    selectedRange?: {
        startLine: number;
        endLine: number;
        side: string;
    } | null;
    onLineSelect?: (lineNum: number, side: string, shiftKey: boolean) => void;
    onLineMouseDown?: (lineNum: number, side: string) => void;
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
        owner: owner ?? "",
        repo: repo ?? "",
        sha: headSha ?? "",
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
                            className="text-gray-500 dark:text-gray-400"
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
                    <div className="d2h-code-line text-gray-400 text-xs">
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
                    <tr
                        key={`gap-${lineNum}`}
                        id={`diff-${fileHash}R${lineNum}`}
                        className={lineHighlighted ? "line-highlighted" : ""}
                    >
                        <td
                            className="d2h-code-linenumber d2h-cntx"
                            onMouseDown={() =>
                                onLineMouseDown?.(lineNum, "RIGHT")
                            }
                            onClick={(e) =>
                                onLineSelect?.(lineNum, "RIGHT", e.shiftKey)
                            }
                            title="Copy permalink"
                        >
                            <div className="absolute">
                                <div className="line-num1">{lineNum}</div>
                                <div className="line-num2">{lineNum}</div>
                            </div>
                        </td>
                        <td className="d2h-cntx">
                            <div
                                className="d2h-code-line"
                                style={{ display: "flex" }}
                            >
                                <span className="d2h-code-line-ctn">
                                    {lineContent || <br />}
                                </span>
                            </div>
                        </td>
                    </tr>
                );
            })}
        </>
    );
}
