import { defaultDiff2HtmlConfig, parse } from "diff2html";
import type {
    ColorSchemeType,
    DiffBlock,
    DiffFile,
    DiffLine,
} from "diff2html/lib/types";
import hljs from "highlight.js";
import type { ReviewComment } from "~/server/github";
import type {
    DiffAnchor,
    DiffGap,
    DiffRenderItem,
    GapRange,
    GapSegment,
} from "./types";

export function normalizeDiffPatch(patch: string, filename: string): string {
    return patch.startsWith("---")
        ? patch
        : `--- a/${filename}\n+++ b/${filename}\n${patch}`;
}

export function parseDiffPatch(
    patch: string,
    filename: string,
    colorScheme: ColorSchemeType,
): DiffFile | null {
    if (!patch) return null;
    const files = parse(normalizeDiffPatch(patch, filename), {
        ...defaultDiff2HtmlConfig,
        colorScheme,
    });
    return files[0] ?? null;
}

export function getDiffLanguage(filename: string): string | null {
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
}

export function getLastNewLine(block: DiffBlock): number {
    let last = block.newStartLine;
    for (const line of block.lines) {
        if (line.newNumber !== undefined) last = line.newNumber;
    }
    return last;
}

export function getLastOldLine(block: DiffBlock): number {
    let last = block.oldStartLine;
    for (const line of block.lines) {
        if (line.oldNumber !== undefined) last = line.oldNumber;
    }
    return last;
}

export function computeBetweenGap(
    prevBlock: DiffBlock,
    curBlock: DiffBlock,
): DiffGap | null {
    const gapStart = getLastNewLine(prevBlock) + 1;
    const gapEnd = curBlock.newStartLine - 1;
    if (gapStart > gapEnd) return null;
    // Between hunks both files hold the same lines, so the old/new numbering
    // diverges by the cumulative diff delta from the previous hunk.
    const delta = getLastOldLine(prevBlock) - getLastNewLine(prevBlock);
    return {
        startLine: gapStart,
        endLine: gapEnd,
        oldStartLine: gapStart + delta,
    };
}

export function createDiffRenderItems(
    parsed: DiffFile | null,
): DiffRenderItem[] {
    if (!parsed?.blocks) return [];
    const items: DiffRenderItem[] = [];
    for (let i = 0; i < parsed.blocks.length; i++) {
        const block = parsed.blocks[i];
        if (!block) continue;
        if (i === 0 && block.newStartLine > 1) {
            items.push({
                type: "gap",
                startLine: 1,
                endLine: block.newStartLine - 1,
                // Nothing above the first hunk differs between the files.
                oldStartLine: 1,
            });
        }
        if (i > 0) {
            const previous = parsed.blocks[i - 1];
            if (previous) {
                const gap = computeBetweenGap(previous, block);
                if (gap) items.push({ type: "gap", ...gap });
            }
        }
        items.push({ type: "block", block });
        if (i === parsed.blocks.length - 1) {
            const newStart = getLastNewLine(block) + 1;
            items.push({
                type: "gap",
                startLine: newStart,
                endLine: -1,
                oldStartLine:
                    newStart + (getLastOldLine(block) - getLastNewLine(block)),
            });
        }
    }
    return items;
}

/**
 * A row of a split (side-by-side) diff. Context lines stand alone; changed
 * lines are paired by index within each contiguous run of changes (deletion
 * followed by addition), like GitHub. Lines left over after pairing get an
 * empty side.
 */
export type SplitRow =
    | { kind: "context"; line: DiffLine }
    | { kind: "paired"; oldLine: DiffLine; newLine: DiffLine }
    | { kind: "del"; line: DiffLine }
    | { kind: "add"; line: DiffLine };

export function buildSplitRows(block: DiffBlock): SplitRow[] {
    const rows: SplitRow[] = [];
    let changeGroup: DiffLine[] = [];

    const flush = () => {
        if (changeGroup.length === 0) return;
        const dels = changeGroup.filter((l) => l.type === "delete");
        const adds = changeGroup.filter((l) => l.type === "insert");
        const paired = Math.min(dels.length, adds.length);
        for (let i = 0; i < paired; i++) {
            rows.push({
                kind: "paired",
                oldLine: dels[i] as DiffLine,
                newLine: adds[i] as DiffLine,
            });
        }
        for (let i = paired; i < adds.length; i++) {
            rows.push({ kind: "add", line: adds[i] as DiffLine });
        }
        for (let i = paired; i < dels.length; i++) {
            rows.push({ kind: "del", line: dels[i] as DiffLine });
        }
        changeGroup = [];
    };

    for (const line of block.lines) {
        if (line.type === "context") {
            flush();
            rows.push({ kind: "context", line });
        } else {
            changeGroup.push(line);
        }
    }
    flush();
    return rows;
}

export function buildDiffPositionMap(
    parsed: DiffFile | null,
): Map<number, DiffAnchor> {
    const map = new Map<number, DiffAnchor>();
    if (!parsed) return map;
    let position = 0;
    for (const block of parsed.blocks) {
        for (const line of block.lines) {
            position += 1;
            if (line.type === "delete") {
                map.set(position, { side: "LEFT", line: line.oldNumber });
            } else {
                map.set(position, { side: "RIGHT", line: line.newNumber });
            }
        }
    }
    return map;
}

/**
 * Where a comment attaches in the current diff, or null when it does not
 * attach at all.
 *
 * GitHub keeps `line` in sync with the head commit and nulls it once the lines
 * the comment was made on are no longer part of the diff. Such an outdated
 * comment lives in the conversation only, so it must not be anchored here -
 * its `position` may still hold a stale index that would land the thread on an
 * unrelated line.
 */
export function resolveDiffCommentAnchor(
    comment: ReviewComment,
    positionMap: Map<number, DiffAnchor>,
): DiffAnchor | null {
    if (comment.line != null) {
        return { side: comment.side ?? "RIGHT", line: comment.line };
    }
    if (comment.original_line != null || comment.original_start_line != null) {
        return null;
    }
    // Drafts predating line-based anchoring carry a diff position only.
    const position = comment.position ?? comment.original_position ?? null;
    return position == null ? null : (positionMap.get(position) ?? null);
}

/** Stable identity of a gap within a file's render items. */
export function diffGapKey(gap: { startLine: number }): string {
    return `gap-${gap.startLine}`;
}

/**
 * New-file line an anchor points at inside `gap`. Gap lines are context lines
 * present on both sides, so an old-side anchor maps onto the new numbering by
 * the gap's constant offset.
 */
export function gapTargetLine(gap: DiffGap, anchor: DiffAnchor): number {
    if (anchor.side === "RIGHT") return anchor.line;
    return anchor.line - (gap.oldStartLine - gap.startLine);
}

/**
 * Lines of unchanged context kept around a comment when its region is
 * revealed, so the thread sits inside code instead of at the edge of the
 * unfolded block.
 */
export const COMMENT_CONTEXT_LINES = 4;

/** Sorts `ranges` and merges the overlapping or adjacent ones. */
export function normalizeGapRanges(ranges: GapRange[]): GapRange[] {
    const sorted = [...ranges]
        .filter((range) => range.end >= range.start)
        .sort((a, b) => a.start - b.start);
    const merged: GapRange[] = [];
    for (const range of sorted) {
        const last = merged[merged.length - 1];
        if (last && range.start <= last.end + 1) {
            last.end = Math.max(last.end, range.end);
            continue;
        }
        merged.push({ ...range });
    }
    return merged;
}

/** Adds `range`, returning `ranges` unchanged when it is already revealed. */
export function addGapRange(ranges: GapRange[], range: GapRange): GapRange[] {
    if (range.end < range.start) return ranges;
    if (
        ranges.some(
            (existing) =>
                existing.start <= range.start && existing.end >= range.end,
        )
    ) {
        return ranges;
    }
    return normalizeGapRanges([...ranges, range]);
}

/**
 * Merges per-gap `additions` into `current`, returning `current` itself when
 * every addition is already revealed.
 */
export function mergeGapRanges(
    current: Map<string, GapRange[]>,
    additions: Map<string, GapRange[]>,
): Map<string, GapRange[]> {
    let next: Map<string, GapRange[]> | null = null;
    for (const [key, ranges] of additions) {
        const existing = next?.get(key) ?? current.get(key) ?? [];
        let merged = existing;
        for (const range of ranges) {
            merged = addGapRange(merged, range);
        }
        if (merged === existing) continue;
        next ??= new Map(current);
        next.set(key, merged);
    }
    return next ?? current;
}

/**
 * Ranges `gap` must reveal so every anchor inside it shows with context above
 * and below. Anchors on hunk lines need nothing revealed; requests are clamped
 * to the gap so they never spill into a hunk.
 */
export function gapCommentRanges(
    gap: DiffGap,
    anchors: DiffAnchor[],
): GapRange[] {
    const gapEnd = gap.endLine === -1 ? Number.POSITIVE_INFINITY : gap.endLine;
    const ranges: GapRange[] = [];
    for (const anchor of anchors) {
        const line = gapTargetLine(gap, anchor);
        if (line < gap.startLine || line > gapEnd) continue;
        ranges.push({
            start: Math.max(gap.startLine, line - COMMENT_CONTEXT_LINES),
            end: Math.min(gapEnd, line + COMMENT_CONTEXT_LINES),
        });
    }
    return normalizeGapRanges(ranges);
}

/**
 * Splits the gap's line span into hidden and revealed runs in render order.
 * Every hidden run gets an unfold row; revealed runs render as context lines.
 */
export function gapSegments(
    startLine: number,
    endLine: number,
    revealed: GapRange[],
): GapSegment[] {
    if (endLine < startLine) return [];
    const segments: GapSegment[] = [];
    let cursor = startLine;
    for (const range of normalizeGapRanges(revealed)) {
        const start = Math.max(range.start, startLine);
        const end = Math.min(range.end, endLine);
        if (end < start || end < cursor) continue;
        if (start > cursor) {
            segments.push({ start: cursor, end: start - 1, hidden: true });
        }
        segments.push({
            start: Math.max(start, cursor),
            end,
            hidden: false,
        });
        cursor = end + 1;
    }
    if (cursor <= endLine) {
        segments.push({ start: cursor, end: endLine, hidden: true });
    }
    return segments;
}

/** Whether `comment`'s anchor is the given line (last line of its range). */
export function isLastLineOfRange(
    comment: ReviewComment,
    positionMap: Map<number, DiffAnchor>,
    line: number,
): boolean {
    return (resolveDiffCommentAnchor(comment, positionMap)?.line ?? 0) === line;
}
