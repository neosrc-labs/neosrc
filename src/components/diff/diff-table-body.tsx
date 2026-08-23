"use client";

import type { ReviewComment } from "~/server/github";
import type { DiffViewMode } from "~/utils/diff-view";
import { BlockRows } from "./diff-block-rows";
import { GapRow } from "./gap-row";
import type {
    DiffAnchor,
    DiffRenderItem,
    DiffRowCommentProps,
    GapExpansion,
} from "./types";

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

export function DiffTableBody({
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
