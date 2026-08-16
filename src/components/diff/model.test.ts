import type { DiffBlock, DiffFile, DiffLine } from "diff2html/lib/types";
import { describe, expect, it } from "vitest";
import {
    buildSplitRows,
    computeBetweenGap,
    createDiffRenderItems,
} from "./model";

function ctx(content: string, num: number): DiffLine {
    return {
        type: "context",
        oldNumber: num,
        newNumber: num,
        content: ` ${content}`,
    } as DiffLine;
}

function del(content: string, oldNum: number): DiffLine {
    return {
        type: "delete",
        oldNumber: oldNum,
        newNumber: undefined,
        content: `-${content}`,
    } as DiffLine;
}

function ins(content: string, newNum: number): DiffLine {
    return {
        type: "insert",
        oldNumber: undefined,
        newNumber: newNum,
        content: `+${content}`,
    } as DiffLine;
}

function block(lines: DiffLine[]): DiffBlock {
    return {
        oldStartLine: 1,
        newStartLine: 1,
        header: "@@ -1,1 +1,1 @@",
        lines,
    } as DiffBlock;
}

describe("buildSplitRows", () => {
    it("passes context lines through unchanged", () => {
        const rows = buildSplitRows(block([ctx("a", 1), ctx("b", 2)]));
        expect(rows).toEqual([
            {
                kind: "context",
                line: expect.objectContaining({ type: "context" }),
            },
            {
                kind: "context",
                line: expect.objectContaining({ type: "context" }),
            },
        ]);
    });

    it("pairs a deletion with the following insertion", () => {
        const rows = buildSplitRows(block([del("old", 1), ins("new", 1)]));
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            kind: "paired",
            oldLine: { type: "delete", oldNumber: 1 },
            newLine: { type: "insert", newNumber: 1 },
        });
    });

    it("leaves extra additions unpaired after pairing by index", () => {
        // 2 deletions + 3 additions -> 2 paired rows + 1 unpaired add
        const rows = buildSplitRows(
            block([
                del("a", 1),
                del("b", 2),
                ins("x", 1),
                ins("y", 2),
                ins("z", 3),
            ]),
        );
        expect(rows.map((r) => r.kind)).toEqual(["paired", "paired", "add"]);
        expect(rows[0]).toMatchObject({
            kind: "paired",
            oldLine: { oldNumber: 1 },
            newLine: { newNumber: 1 },
        });
        expect(rows[1]).toMatchObject({
            kind: "paired",
            oldLine: { oldNumber: 2 },
            newLine: { newNumber: 2 },
        });
        expect(rows[2]).toMatchObject({
            kind: "add",
            line: { newNumber: 3 },
        });
    });

    it("leaves extra deletions unpaired with an empty right side", () => {
        const rows = buildSplitRows(
            block([del("a", 1), del("b", 2), ins("x", 1)]),
        );
        expect(rows.map((r) => r.kind)).toEqual(["paired", "del"]);
        expect(rows[1]).toMatchObject({
            kind: "del",
            line: { oldNumber: 2 },
        });
    });

    it("keeps change groups separated by context lines", () => {
        const rows = buildSplitRows(
            block([
                del("a", 1),
                ins("x", 1),
                ctx("mid", 2),
                del("b", 3),
                ins("y", 3),
            ]),
        );
        expect(rows.map((r) => r.kind)).toEqual([
            "paired",
            "context",
            "paired",
        ]);
    });
});

describe("gap old-line numbering", () => {
    // Block 1: old 1-5 / new 1-6 (one insertion at the end).
    const block1: DiffBlock = {
        oldStartLine: 1,
        newStartLine: 1,
        header: "@@ -1,5 +1,6 @@",
        lines: [
            ctx("a", 1),
            ctx("b", 2),
            ctx("c", 3),
            ctx("d", 4),
            ctx("e", 5),
            ins("x", 6),
        ],
    };
    // Block 2: new 10-11 / old 9-10 (delta -1 carried from block 1).
    const block2: DiffBlock = {
        oldStartLine: 9,
        newStartLine: 10,
        header: "@@ -9,2 +10,2 @@",
        lines: [ctx("f", 9), ctx("g", 10)],
    };

    it("maps a middle gap to the old side by the previous hunk's delta", () => {
        const gap = computeBetweenGap(block1, block2);
        // New gap 7-9 sits between the hunks; block 1 ends at old 5 / new 6,
        // so the old numbering trails by one.
        expect(gap).toEqual({ startLine: 7, endLine: 9, oldStartLine: 6 });
    });

    it("keeps the old line constant within the gap", () => {
        const items = createDiffRenderItems({
            blocks: [block1, block2],
        } as unknown as DiffFile);
        const gap = items.find(
            (item): item is Extract<typeof item, { type: "gap" }> =>
                item.type === "gap" &&
                item.startLine === 7 &&
                item.endLine === 9,
        );
        expect(gap?.oldStartLine).toBe(6);
    });

    it("numbers leading gaps identically on both sides", () => {
        const items = createDiffRenderItems({
            blocks: [
                {
                    oldStartLine: 40,
                    newStartLine: 40,
                    header: "@@ -40,1 +40,1 @@",
                    lines: [ctx("h", 40)],
                } as DiffBlock,
            ],
        } as unknown as DiffFile);
        expect(items[0]).toEqual({
            type: "gap",
            startLine: 1,
            endLine: 39,
            oldStartLine: 1,
        });
    });

    it("applies the last hunk's delta to the trailing gap", () => {
        const items = createDiffRenderItems({
            blocks: [block1],
        } as unknown as DiffFile);
        const trailing = items[items.length - 1];
        expect(trailing).toEqual({
            type: "gap",
            startLine: 7,
            endLine: -1,
            oldStartLine: 6,
        });
    });
});
