"use client";

import type { DiffBlock } from "diff2html/lib/types";
import type { ReviewComment } from "~/server/github";
import type { DiffViewMode } from "~/utils/diff-view";
import { SplitBlockRows } from "./split-block-rows";
import type { DiffAnchor, DiffRowCommentProps } from "./types";
import { UnifiedBlockRows } from "./unified-block-rows";
import type { DiffRowLines } from "./use-diff-line-selection";

interface BlockRowsProps {
    block: DiffBlock;
    commentsByLine: Map<string, ReviewComment[]>;
    positionMap: Map<number, DiffAnchor>;
    multiLineRanges: Map<string, string[]>;
    owner: string | undefined;
    repo: string | undefined;
    fileHash: string | undefined;
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
    fileHash,
    view = "unified",
    selectedRange,
    onLineSelect,
    onLineMouseDown,
    commentProps,
}: BlockRowsProps) {
    return view === "split" ? (
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
    );
}
