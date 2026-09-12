import type { ReviewCommentBase } from "~/server/github";

export interface SnippetRow {
    kind: "context" | "insert" | "delete";
    /** Old-side line number, null for lines that only exist in the new file. */
    oldNumber: number | null;
    /** New-side line number, null for lines that only exist in the old file. */
    newNumber: number | null;
    content: string;
}

/** Lines of leading context shown above the commented line. */
export const SNIPPET_CONTEXT_LINES = 3;
/** Cap so a wide multi-line comment cannot flood the timeline. */
export const SNIPPET_MAX_ROWS = 8;

export interface SnippetAnchor {
    /** Last line of the commented range. */
    line: number;
    /** First line of the commented range, equal to `line` for single-line comments. */
    startLine: number;
    side: "LEFT" | "RIGHT";
    /** Commit the line numbers refer to. */
    sha: string;
}

/**
 * Where a comment's snippet should end. Outdated comments (`line` nulled by
 * GitHub once their lines left the diff) fall back to the original
 * coordinates, which still describe the commit they were written against.
 * File-level comments have no line and get no snippet.
 */
export function snippetAnchor(
    comment: ReviewCommentBase,
): SnippetAnchor | null {
    const isCurrent = comment.line != null;
    const line = comment.line ?? comment.original_line ?? null;
    if (line == null) {
        return null;
    }
    const start =
        (isCurrent ? comment.start_line : comment.original_start_line) ?? line;
    return {
        line,
        startLine: Math.min(start, line),
        side: comment.side === "LEFT" ? "LEFT" : "RIGHT",
        sha: isCurrent ? comment.commit_id : comment.original_commit_id,
    };
}

function parseHunk(diffHunk: string): SnippetRow[] {
    const lines = diffHunk.split("\n");
    const header = lines[0]?.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (!header) {
        return [];
    }
    let oldNumber = Number(header[1]);
    let newNumber = Number(header[2]);
    const rows: SnippetRow[] = [];
    for (const line of lines.slice(1)) {
        const prefix = line[0] ?? "";
        const content = line.slice(1);
        if (prefix === "+") {
            rows.push({
                kind: "insert",
                content,
                oldNumber: null,
                newNumber: newNumber++,
            });
        } else if (prefix === "-") {
            rows.push({
                kind: "delete",
                content,
                oldNumber: oldNumber++,
                newNumber: null,
            });
        } else if (prefix === " ") {
            rows.push({
                kind: "context",
                content,
                oldNumber: oldNumber++,
                newNumber: newNumber++,
            });
        }
        // "\ No newline at end of file" carries no line of its own.
    }
    return rows;
}

function clampWindow(rows: SnippetRow[], start: number, end: number) {
    const from = Math.max(0, end - SNIPPET_MAX_ROWS + 1, start);
    return rows.slice(from, end + 1);
}

/**
 * The tail of a comment's diff hunk, ending at the commented line. Returns
 * nothing when the hunk is absent or does not cover that line, which is what
 * GitHub sends for comments anchored to lines outside the diff.
 */
export function hunkSnippetRows(
    diffHunk: string,
    anchor: SnippetAnchor,
): SnippetRow[] {
    const rows = parseHunk(diffHunk);
    const numberOn = (row: SnippetRow) =>
        anchor.side === "LEFT" ? row.oldNumber : row.newNumber;
    const end = rows.findIndex((row) => numberOn(row) === anchor.line);
    if (end === -1) {
        return [];
    }
    const rangeStart = rows.findIndex(
        (row) => numberOn(row) === anchor.startLine,
    );
    const first = rangeStart === -1 ? end : Math.min(rangeStart, end);
    const start = first - SNIPPET_CONTEXT_LINES;
    return clampWindow(rows, start, end);
}

/**
 * Snippet built straight from the file at the comment's commit, for comments
 * whose lines are not part of any hunk. The file only describes the new side,
 * so the rows carry no old-side number.
 */
export function fileSnippetRows(
    lines: string[],
    anchor: SnippetAnchor,
): SnippetRow[] {
    if (anchor.line > lines.length) {
        return [];
    }
    const rows: SnippetRow[] = [];
    const from = Math.max(1, anchor.startLine - SNIPPET_CONTEXT_LINES);
    for (let line = from; line <= anchor.line; line++) {
        rows.push({
            kind: "context",
            oldNumber: null,
            newNumber: line,
            content: lines[line - 1] ?? "",
        });
    }
    return clampWindow(rows, 0, rows.length - 1);
}
