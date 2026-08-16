import type { DiffBlock, DiffLine } from "diff2html/lib/types";
import { describe, expect, it } from "vitest";
import { buildSplitRows } from "./model";

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
