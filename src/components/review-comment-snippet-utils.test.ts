import { describe, expect, it } from "vitest";
import type { ReviewCommentBase } from "~/server/github";
import {
    fileSnippetRows,
    hunkSnippetRows,
    SNIPPET_MAX_ROWS,
    type SnippetAnchor,
    snippetAnchor,
} from "./review-comment-snippet-utils";

// @@ -8,4 +8,5 @@: old 8-11, new 8-12.
const HUNK = [
    "@@ -8,4 +8,5 @@ fn thing()",
    " a()",
    " b()",
    " c()",
    "-old()",
    "+one()",
    "+two()",
    "+three()",
].join("\n");

function anchor(
    overrides: Partial<SnippetAnchor> & { line?: number } = {},
): SnippetAnchor {
    const line = overrides.line ?? 12;
    return {
        line,
        startLine: line,
        side: "RIGHT",
        sha: "sha",
        ...overrides,
    };
}

function comment(overrides: Record<string, unknown>) {
    return {
        line: null,
        original_line: null,
        start_line: null,
        original_start_line: null,
        side: "RIGHT",
        commit_id: "head",
        original_commit_id: "original",
        ...overrides,
    } as unknown as ReviewCommentBase;
}

describe("snippetAnchor", () => {
    it("uses the current coordinates and commit", () => {
        expect(snippetAnchor(comment({ line: 20, start_line: 18 }))).toEqual({
            line: 20,
            startLine: 18,
            side: "RIGHT",
            sha: "head",
        });
    });

    it("falls back to the original coordinates for an outdated comment", () => {
        expect(
            snippetAnchor(
                comment({ original_line: 99, original_start_line: 97 }),
            ),
        ).toEqual({
            line: 99,
            startLine: 97,
            side: "RIGHT",
            sha: "original",
        });
    });

    it("has no anchor for a file-level comment", () => {
        expect(snippetAnchor(comment({ subject_type: "file" }))).toBeNull();
    });
});

describe("hunkSnippetRows", () => {
    it("ends at the commented line and keeps leading context", () => {
        expect(hunkSnippetRows(HUNK, anchor({ line: 11 }))).toEqual([
            { kind: "context", oldNumber: 9, newNumber: 9, content: "b()" },
            { kind: "context", oldNumber: 10, newNumber: 10, content: "c()" },
            {
                kind: "delete",
                oldNumber: 11,
                newNumber: null,
                content: "old()",
            },
            {
                kind: "insert",
                oldNumber: null,
                newNumber: 11,
                content: "one()",
            },
        ]);
    });

    it("resolves the line on the old side for a LEFT comment", () => {
        expect(
            hunkSnippetRows(HUNK, anchor({ line: 11, side: "LEFT" })),
        ).toEqual([
            { kind: "context", oldNumber: 8, newNumber: 8, content: "a()" },
            { kind: "context", oldNumber: 9, newNumber: 9, content: "b()" },
            { kind: "context", oldNumber: 10, newNumber: 10, content: "c()" },
            {
                kind: "delete",
                oldNumber: 11,
                newNumber: null,
                content: "old()",
            },
        ]);
    });

    it("covers a multi-line range", () => {
        const rows = hunkSnippetRows(HUNK, anchor({ startLine: 10, line: 13 }));
        expect(rows.map((row) => row.content)).toEqual([
            "a()",
            "b()",
            "c()",
            "old()",
            "one()",
            "two()",
            "three()",
        ]);
    });

    it("caps a range wider than the row limit, keeping the end", () => {
        const wide = [
            "@@ -1,0 +1,40 @@",
            ...Array.from({ length: 40 }, (_, i) => `+line${i + 1}`),
        ].join("\n");

        const rows = hunkSnippetRows(wide, anchor({ startLine: 1, line: 40 }));

        expect(rows).toHaveLength(SNIPPET_MAX_ROWS);
        expect(rows.at(-1)?.newNumber).toBe(40);
    });

    it("has no rows when the hunk does not cover the commented line", () => {
        expect(hunkSnippetRows(HUNK, anchor({ line: 400 }))).toEqual([]);
        expect(hunkSnippetRows("", anchor())).toEqual([]);
    });
});

describe("fileSnippetRows", () => {
    const lines = Array.from({ length: 30 }, (_, i) => `line${i + 1}`);

    it("ends at the commented line", () => {
        expect(fileSnippetRows(lines, anchor({ line: 5 }))).toEqual([
            {
                kind: "context",
                oldNumber: null,
                newNumber: 2,
                content: "line2",
            },
            {
                kind: "context",
                oldNumber: null,
                newNumber: 3,
                content: "line3",
            },
            {
                kind: "context",
                oldNumber: null,
                newNumber: 4,
                content: "line4",
            },
            {
                kind: "context",
                oldNumber: null,
                newNumber: 5,
                content: "line5",
            },
        ]);
    });

    it("clamps to the start of the file", () => {
        expect(
            fileSnippetRows(lines, anchor({ line: 2 })).map(
                (row) => row.newNumber,
            ),
        ).toEqual([1, 2]);
    });

    it("caps a wide range, keeping the end", () => {
        const rows = fileSnippetRows(lines, anchor({ startLine: 1, line: 30 }));

        expect(rows).toHaveLength(SNIPPET_MAX_ROWS);
        expect(rows.at(-1)?.newNumber).toBe(30);
    });

    it("has no rows when the line is past the end of the file", () => {
        expect(fileSnippetRows(lines, anchor({ line: 31 }))).toEqual([]);
    });
});
