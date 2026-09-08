"use client";

import { ArrowDownFromLine, ArrowUpFromLine } from "lucide-react";
import { useFileContent } from "~/hooks/use-file-content";
import type { ReviewComment } from "~/server/github";
import type { DiffViewMode } from "~/utils/diff-view";
import { DiffContextRow } from "./diff-context-row";
import { gapSegments } from "./model";
import type {
    DiffAnchor,
    DiffGap,
    DiffRowCommentProps,
    GapRange,
} from "./types";
import type { DiffRowLines } from "./use-diff-line-selection";

// Number of context lines revealed by a single unfold click. Clicking again
// reveals the next chunk until the hidden run is exhausted.
export const GAP_EXPAND_STEP = 20;

interface GapRowsProps {
    gap: DiffGap;
    gapKey: string;
    /** Runs of the gap already revealed, in new-file coordinates. */
    revealed: GapRange[];
    expandAll: boolean;
    /** Header of the hunk this gap leads into, shown on the last unfold row. */
    header?: string;
    onExpand: (key: string, range: GapRange) => void;
    owner: string | undefined;
    repo: string | undefined;
    headSha: string | undefined;
    filename: string;
    fileHash: string | undefined;
    view: DiffViewMode;
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
    commentsByLine: Map<string, ReviewComment[]>;
    positionMap: Map<number, DiffAnchor>;
    multiLineRanges: Map<string, string[]>;
    commentProps: DiffRowCommentProps;
}

export function GapRows({
    gap,
    gapKey,
    revealed,
    expandAll,
    header,
    onExpand,
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
}: GapRowsProps) {
    const { lines, isLoading, error } = useFileContent({
        owner,
        repo,
        sha: headSha,
        path: filename,
    });

    const infoColSpan = view === "split" ? 3 : 1;
    // The trailing gap runs to the end of the file, so its extent is only
    // known once the file content arrives.
    const endLine =
        gap.endLine === -1
            ? (lines?.length ?? -1)
            : Math.min(gap.endLine, lines?.length ?? gap.endLine);

    const unfoldRow = (
        segment: { start: number; end: number },
        isLast: boolean,
    ) => {
        const above = {
            start: segment.start,
            end: Math.min(segment.end, segment.start + GAP_EXPAND_STEP - 1),
        };
        const below = {
            start: Math.max(segment.start, segment.end - GAP_EXPAND_STEP + 1),
            end: segment.end,
        };
        return (
            <tr key={`unfold-${segment.start}`}>
                <td className="d2h-code-linenumber d2h-info">
                    <div className="absolute inset-0 flex items-stretch">
                        <button
                            type="button"
                            onClick={() => onExpand(gapKey, below)}
                            title="Expand lines below"
                            aria-label="Expand lines below"
                            className="flex flex-1 cursor-pointer items-center justify-center text-text-tertiary transition-colors hover:bg-surface-selected hover:text-text-label"
                        >
                            <ArrowUpFromLine size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => onExpand(gapKey, above)}
                            title="Expand lines above"
                            aria-label="Expand lines above"
                            className="flex flex-1 cursor-pointer items-center justify-center border-border border-l text-text-tertiary transition-colors hover:bg-surface-selected hover:text-text-label"
                        >
                            <ArrowDownFromLine size={14} />
                        </button>
                    </div>
                </td>
                <td className="d2h-info" colSpan={infoColSpan}>
                    <div
                        className="d2h-code-line"
                        style={{ userSelect: "text" }}
                    >
                        {isLast ? header : null}
                    </div>
                </td>
            </tr>
        );
    };

    // Gap lines are context lines: within a gap, old and new numbering differ
    // by a constant offset (see DiffGap.oldStartLine).
    const oldDelta = gap.oldStartLine - gap.startLine;

    const contextRow = (lineNum: number, content: string) => (
        <DiffContextRow
            key={`gap-${lineNum}`}
            lineNum={lineNum}
            oldLine={lineNum + oldDelta}
            content={content}
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

    if (!lines) {
        if (error || !headSha) return null;
        // Keep the unfold row (and the hunk header) in place while the file
        // loads so revealing context does not shift the diff around. The
        // trailing gap's size is still unknown here, hence the open range.
        const pendingEnd =
            gap.endLine === -1 ? Number.MAX_SAFE_INTEGER : endLine;
        if (pendingEnd < gap.startLine) return null;
        if (isLoading && revealed.length > 0) {
            return (
                <tr>
                    <td className="d2h-code-linenumber d2h-info" />
                    <td className="d2h-info" colSpan={infoColSpan}>
                        <div className="d2h-code-line text-text-muted text-xs">
                            Loading...
                        </div>
                    </td>
                </tr>
            );
        }
        return unfoldRow({ start: gap.startLine, end: pendingEnd }, true);
    }

    if (endLine < gap.startLine) return null;

    const segments = gapSegments(
        gap.startLine,
        endLine,
        expandAll ? [{ start: gap.startLine, end: endLine }] : revealed,
    );

    return (
        <>
            {segments.map((segment, index) =>
                segment.hidden
                    ? unfoldRow(segment, index === segments.length - 1)
                    : lines
                          .slice(segment.start - 1, segment.end)
                          .map((content, offset) =>
                              contextRow(segment.start + offset, content),
                          ),
            )}
        </>
    );
}
