"use client";

import type { ColorSchemeType, DiffFile } from "diff2html/lib/types";
import "diff2html/bundles/css/diff2html.min.css";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PullRequestPermissionContext } from "~/app/gh/[owner]/[repo]/pull/[number]/permissions-utils";
import type { ReviewComment } from "~/server/github";
import type { DiffViewMode } from "~/utils/diff-view";
import { filenameHash } from "~/utils/filename-hash";
import { scheduleIdle } from "~/utils/schedule-idle";
import { DiffTable } from "./diff/diff-table";
import { DiffTableBody } from "./diff/diff-table-body";
import {
    buildDiffPositionMap,
    createDiffRenderItems,
    getDiffLanguage,
    parseDiffPatch,
    resolveDiffCommentAnchor,
} from "./diff/model";
import type {
    DiffCommentTarget,
    DiffRowCommentProps,
    GapExpansion,
} from "./diff/types";
import { useDiffCommentSelection } from "./diff/use-diff-comment-selection";
import { useDiffHashNavigation } from "./diff/use-diff-hash-navigation";
import { useDiffLineSelection } from "./diff/use-diff-line-selection";
import { useDiffSyntaxHighlighting } from "./diff/use-diff-syntax-highlighting";
import type { FooterAction } from "./markdown/markdown-editor";

export type { DiffCommentTarget } from "./diff/types";

// Breathing room between the sticky bars and the line a permalink scrolls to.
const SCROLL_TARGET_PADDING = 12;

interface DiffViewProps extends DiffCommentProps {
    patch: string;
    filename: string;
    headSha?: string;
    expandAllContext?: boolean;
    view?: DiffViewMode;
    inView?: boolean;
    inViewReady?: boolean;
    estimatedHeight?: number;
    idleParse?: boolean;
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
    inView = true,
    inViewReady = true,
    estimatedHeight = 0,
    idleParse = true,
}: DiffViewProps) {
    const [idleParseDone, setIdleParseDone] = useState(0);
    const idleParseDoneRef = useRef(0);
    const idleParseControllerRef = useRef<(() => void) | null>(null);
    const finishIdleParse = useCallback(() => {
        idleParseDoneRef.current += 1;
        setIdleParseDone((count) => count + 1);
    }, []);
    const { resolvedTheme } = useTheme();

    const parsedRef = useRef<{ key: string; value: DiffFile | null } | null>(
        null,
    );
    const parseKey = `${patch}\u0000${filename}\u0000${resolvedTheme}`;
    const parsed = useMemo(() => {
        void idleParseDone;
        if (!inView) return null;
        if (parsedRef.current?.key === parseKey) {
            return parsedRef.current.value;
        }
        const value = parseDiffPatch(
            patch,
            filename,
            resolvedTheme === "dark"
                ? ("dark" as ColorSchemeType)
                : ("light" as ColorSchemeType),
        );
        parsedRef.current = { key: parseKey, value };
        return value;
    }, [inView, idleParseDone, parseKey, patch, filename, resolvedTheme]);
    useEffect(() => {
        idleParseDoneRef.current = 0;
        if (!idleParse || !patch || parsedRef.current?.key === parseKey) {
            return;
        }

        const cancel = scheduleIdle(() => {
            if (parsedRef.current?.key !== parseKey) {
                parsedRef.current = {
                    key: parseKey,
                    value: parseDiffPatch(
                        patch,
                        filename,
                        resolvedTheme === "dark"
                            ? ("dark" as ColorSchemeType)
                            : ("light" as ColorSchemeType),
                    ),
                };
            }
            finishIdleParse();
        });
        idleParseControllerRef.current = cancel;

        return () => {
            cancel();
            if (idleParseControllerRef.current === cancel) {
                idleParseControllerRef.current = null;
            }
        };
    }, [idleParse, parseKey, patch, filename, resolvedTheme, finishIdleParse]);

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
        rerenderKey: `${expandedLineCount}-${expandAllContext}-${view}`,
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
        if (inView && parsedRef.current && idleParseDoneRef.current > 0) {
            finishIdleParse();
        }
    }, [parsed, inView, finishIdleParse]);

    useDiffHashNavigation({
        parsed: Boolean(parsed),
        fileHash,
        renderItemsRef,
        setExpandedGaps,
        setSelectedRange: lineSelection.setSelectedRange,
    });

    if (!parsed) {
        return (
            <pre
                className="whitespace-pre bg-surface px-4 py-3 font-mono text-text-secondary text-xs leading-5"
                style={{
                    minHeight: estimatedHeight || undefined,
                    visibility: inViewReady ? undefined : "hidden",
                }}
            >
                {patch}
            </pre>
        );
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
