import type { DiffFile } from "diff2html/lib/types";
import { describe, expect, it } from "vitest";
import type { ReviewComment } from "~/server/github";
import {
    buildDiffPositionMap,
    computeBetweenGap,
    createDiffRenderItems,
    normalizeDiffPatch,
    resolveDiffCommentAnchor,
} from "./model";

const block = (newStartLine: number, lines: Array<Record<string, unknown>>) =>
    ({ newStartLine, lines }) as never;

const parsed = (blocks: unknown[]) => ({ blocks }) as DiffFile;

const comment = (value: Record<string, unknown>) =>
    value as unknown as ReviewComment;

describe("diff model", () => {
    it("normalizes patches only when file headers are absent", () => {
        expect(normalizeDiffPatch("@@ -1 +1 @@\n-a\n+b", "src/a.ts")).toBe(
            "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-a\n+b",
        );
        const patch = "--- a/old.ts\n+++ b/new.ts\n@@ -1 +1 @@";
        expect(normalizeDiffPatch(patch, "new.ts")).toBe(patch);
    });

    it("creates leading, between, and trailing render gaps", () => {
        const first = block(4, [{ newNumber: 4 }]);
        const second = block(9, [{ newNumber: 9 }]);
        expect(createDiffRenderItems(parsed([first, second]))).toEqual([
            { type: "gap", startLine: 1, endLine: 3 },
            { type: "block", block: first },
            { type: "gap", startLine: 5, endLine: 8 },
            { type: "block", block: second },
            { type: "gap", startLine: 10, endLine: -1 },
        ]);
        expect(computeBetweenGap(first, second)).toEqual({
            startLine: 5,
            endLine: 8,
        });
    });

    it("maps deprecated positions and prefers submitted line coordinates", () => {
        const diff = parsed([
            block(1, [
                { type: "delete", oldNumber: 3 },
                { type: "insert", newNumber: 4 },
            ]),
        ]);
        const positions = buildDiffPositionMap(diff);
        expect(
            resolveDiffCommentAnchor(comment({ position: 1 }), positions),
        ).toEqual({ side: "LEFT", line: 3 });
        expect(
            resolveDiffCommentAnchor(
                comment({ line: 8, side: "RIGHT", position: 1 }),
                positions,
            ),
        ).toEqual({ side: "RIGHT", line: 8 });
        expect(
            resolveDiffCommentAnchor(comment({ position: 99 }), positions),
        ).toBeNull();
        expect(
            resolveDiffCommentAnchor(
                comment({ original_position: 2 }),
                positions,
            ),
        ).toEqual({ side: "RIGHT", line: 4 });
    });
});
