"use client";

import type { ReviewComment } from "~/server/github";
import type { DiffViewMode } from "~/utils/diff-view";
import { BlockRows } from "./diff-block-rows";
import { GapRows } from "./gap-rows";
import { diffGapKey } from "./model";
import type {
    DiffAnchor,
    DiffRenderItem,
    DiffRowCommentProps,
    GapRange,
} from "./types";

const NO_RANGES: GapRange[] = [];

interface DiffTableBodyProps {
    items: DiffRenderItem[];
    expandAllContext: boolean;
    expandedGaps: Map<string, GapRange[]>;
    onGapExpand: (key: string, range: GapRange) => void;
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
                    const gapKey = diffGapKey(item);
                    // A gap leads into the following hunk, whose header is
                    // shown on the unfold row directly above it.
                    const next = items[idx + 1];
                    return (
                        <GapRows
                            key={gapKey}
                            gap={item}
                            gapKey={gapKey}
                            revealed={expandedGaps.get(gapKey) ?? NO_RANGES}
                            expandAll={expandAllContext}
                            header={
                                next?.type === "block"
                                    ? next.block.header
                                    : undefined
                            }
                            onExpand={onGapExpand}
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
                return (
                    <BlockRows
                        key={`block-${item.block.newStartLine}`}
                        block={item.block}
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
