import type { DiffBlock, DiffFile, DiffLine } from "diff2html/lib/types";
import { describe, expect, it } from "vitest";
import {
    addGapRange,
    buildSplitRows,
    computeBetweenGap,
    createDiffRenderItems,
    gapCommentRanges,
    gapSegments,
    gapTargetLine,
    mergeGapRanges,
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

describe("gapCommentRanges", () => {
    const middleGap = { startLine: 100, endLine: 200, oldStartLine: 90 };

    it("reveals four lines of context on each side of the comment", () => {
        expect(
            gapCommentRanges(middleGap, [{ side: "RIGHT", line: 150 }]),
        ).toEqual([{ start: 146, end: 154 }]);
    });

    it("clamps the window to the gap", () => {
        expect(
            gapCommentRanges(middleGap, [
                { side: "RIGHT", line: 101 },
                { side: "RIGHT", line: 199 },
            ]),
        ).toEqual([
            { start: 100, end: 105 },
            { start: 195, end: 200 },
        ]);
    });

    it("merges windows of nearby comments", () => {
        expect(
            gapCommentRanges(middleGap, [
                { side: "RIGHT", line: 150 },
                { side: "RIGHT", line: 156 },
            ]),
        ).toEqual([{ start: 146, end: 160 }]);
    });

    it("reveals nothing for comments outside the gap", () => {
        expect(
            gapCommentRanges(middleGap, [
                { side: "RIGHT", line: 42 },
                { side: "RIGHT", line: 300 },
            ]),
        ).toEqual([]);
    });

    it("maps old-side comments through the gap's numbering", () => {
        expect(
            gapCommentRanges(middleGap, [{ side: "LEFT", line: 140 }]),
        ).toEqual([{ start: 146, end: 154 }]);
    });

    it("keeps the window open-ended past the last hunk", () => {
        expect(
            gapCommentRanges(
                { startLine: 500, endLine: -1, oldStartLine: 480 },
                [{ side: "RIGHT", line: 530 }],
            ),
        ).toEqual([{ start: 526, end: 534 }]);
    });
});

describe("gapSegments", () => {
    it("marks the whole gap hidden when nothing is revealed", () => {
        expect(gapSegments(10, 50, [])).toEqual([
            { start: 10, end: 50, hidden: true },
        ]);
    });

    it("splits a mid-gap window into hidden runs above and below", () => {
        expect(gapSegments(10, 50, [{ start: 20, end: 24 }])).toEqual([
            { start: 10, end: 19, hidden: true },
            { start: 20, end: 24, hidden: false },
            { start: 25, end: 50, hidden: true },
        ]);
    });

    it("leaves no unfold run once the gap is fully revealed", () => {
        expect(gapSegments(10, 12, [{ start: 1, end: 99 }])).toEqual([
            { start: 10, end: 12, hidden: false },
        ]);
    });

    it("keeps separate windows apart", () => {
        expect(
            gapSegments(1, 40, [
                { start: 5, end: 6 },
                { start: 30, end: 31 },
            ]),
        ).toEqual([
            { start: 1, end: 4, hidden: true },
            { start: 5, end: 6, hidden: false },
            { start: 7, end: 29, hidden: true },
            { start: 30, end: 31, hidden: false },
            { start: 32, end: 40, hidden: true },
        ]);
    });
});

describe("gapTargetLine", () => {
    const gap = { startLine: 100, endLine: 200, oldStartLine: 90 };

    it("keeps new-side lines as they are", () => {
        expect(gapTargetLine(gap, { side: "RIGHT", line: 150 })).toBe(150);
    });

    it("shifts old-side lines onto the new numbering", () => {
        expect(gapTargetLine(gap, { side: "LEFT", line: 140 })).toBe(150);
    });
});

describe("addGapRange", () => {
    it("merges a range that touches an existing run", () => {
        expect(addGapRange([{ start: 10, end: 20 }], { start: 21, end: 25 })) //
            .toEqual([{ start: 10, end: 25 }]);
    });

    it("returns the same array when the range is already revealed", () => {
        const ranges = [{ start: 10, end: 20 }];
        expect(addGapRange(ranges, { start: 12, end: 18 })).toBe(ranges);
    });

    it("keeps a disjoint range separate", () => {
        expect(addGapRange([{ start: 10, end: 20 }], { start: 40, end: 45 })) //
            .toEqual([
                { start: 10, end: 20 },
                { start: 40, end: 45 },
            ]);
    });
});

describe("mergeGapRanges", () => {
    it("adds the new runs per gap", () => {
        const current = new Map([["gap-1", [{ start: 5, end: 9 }]]]);
        const merged = mergeGapRanges(
            current,
            new Map([["gap-1", [{ start: 20, end: 24 }]]]),
        );
        expect(merged.get("gap-1")).toEqual([
            { start: 5, end: 9 },
            { start: 20, end: 24 },
        ]);
    });

    it("returns the same map when every run is already revealed", () => {
        const current = new Map([["gap-1", [{ start: 5, end: 30 }]]]);
        expect(
            mergeGapRanges(
                current,
                new Map([["gap-1", [{ start: 10, end: 20 }]]]),
            ),
        ).toBe(current);
    });
});
