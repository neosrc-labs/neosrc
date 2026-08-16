import { defaultDiff2HtmlConfig, parse } from "diff2html";
import type {
    ColorSchemeType,
    DiffBlock,
    DiffFile,
    DiffLine,
} from "diff2html/lib/types";
import hljs from "highlight.js";
import type { ReviewComment } from "~/server/github";
import type { DiffAnchor, DiffGap, DiffRenderItem } from "./types";

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

export function computeBetweenGap(
    prevBlock: DiffBlock,
    curBlock: DiffBlock,
): DiffGap | null {
    const gapStart = getLastNewLine(prevBlock) + 1;
    const gapEnd = curBlock.newStartLine - 1;
    return gapStart <= gapEnd ? { startLine: gapStart, endLine: gapEnd } : null;
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
            items.push({
                type: "gap",
                startLine: getLastNewLine(block) + 1,
                endLine: -1,
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

export function resolveDiffCommentAnchor(
    comment: ReviewComment,
    positionMap: Map<number, DiffAnchor>,
): DiffAnchor | null {
    if (comment.line != null) {
        return { side: comment.side ?? "RIGHT", line: comment.line };
    }
    const position = comment.position ?? comment.original_position ?? null;
    return position == null ? null : (positionMap.get(position) ?? null);
}

/** Whether `comment`'s anchor is the given line (last line of its range). */
export function isLastLineOfRange(
    comment: ReviewComment,
    positionMap: Map<number, DiffAnchor>,
    line: number,
): boolean {
    return (resolveDiffCommentAnchor(comment, positionMap)?.line ?? 0) === line;
}
