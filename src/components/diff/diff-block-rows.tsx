"use client";

import type { DiffBlock } from "diff2html/lib/types";
import { ArrowDownFromLine, ArrowUpFromLine } from "lucide-react";
import { useFileContent } from "~/hooks/use-file-content";
import type { ReviewComment } from "~/server/github";
import type { DiffViewMode } from "~/utils/diff-view";
import { DiffContextRow } from "./diff-context-row";
import { SplitBlockRows } from "./split-block-rows";
import type {
    DiffAnchor,
    DiffGap,
    DiffRowCommentProps,
    GapExpansion,
} from "./types";
import { UnifiedBlockRows } from "./unified-block-rows";
import type { DiffRowLines } from "./use-diff-line-selection";

// Number of context lines revealed by a single expand click. Clicking again
// reveals the next chunk until the gap is exhausted.
export const GAP_EXPAND_STEP = 20;

/** Gap/navigation props shared by the diff table row components. */
export function getDiffGapSize(
    gap: { startLine: number; endLine: number } | undefined,
    fileLineCount: number | undefined,
): number {
    if (!gap) return 0;
    const endLine = gap.endLine === -1 ? (fileLineCount ?? -1) : gap.endLine;
    return endLine - gap.startLine + 1;
}

export interface DiffRowNavigationProps {
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

export interface BlockRowsSharedProps {
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

export function BlockRows({
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
