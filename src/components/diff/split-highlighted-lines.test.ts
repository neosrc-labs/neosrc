import hljs from "highlight.js";
import { describe, expect, it } from "vitest";
import { splitHighlightedLines } from "./use-diff-syntax-highlighting";

/** Highlighted lines of a code block, one HTML string per source line. */
function highlightedLines(source: string, language: string): string[] {
    return splitHighlightedLines(hljs.highlight(source, { language }).value);
}

describe("splitHighlightedLines", () => {
    it("keeps a block comment marked across every line", () => {
        const lines = highlightedLines(
            [
                "/**",
                " * Refreshes the account row; default and in the UI.",
                " * Skipping the input fetch when the sync is under the window.",
                " */",
                "export async function syncCurrentUser() {}",
            ].join("\n"),
            "typescript",
        );

        expect(lines).toHaveLength(5);
        for (const index of [0, 1, 2, 3]) {
            expect(lines[index]).toContain('class="hljs-comment"');
        }
        // Comment words like `default` and `window` must not tokenize as code.
        expect(lines[1]).not.toContain("hljs-keyword");
        expect(lines[2]).not.toContain("hljs-variable");
        // Code after the comment still highlights.
        expect(lines[4]).toContain('class="hljs-keyword"');

        for (const line of lines) {
            expect(matches(line, "<span")).toBe(matches(line, "</span>"));
        }
    });

    it("splits plain text one entry per line", () => {
        expect(splitHighlightedLines("a\nb\n")).toEqual(["a", "b", ""]);
        expect(splitHighlightedLines("")).toEqual([""]);
    });
});

function matches(text: string, needle: string): number {
    return text.split(needle).length - 1;
}
