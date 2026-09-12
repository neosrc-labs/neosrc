import { describe, expect, it } from "vitest";
import { highlightLines } from "./highlight";

const TIMEOUT = 30_000;

/** Tokens in a highlighted line, as `{ text, style }`. */
function tokens(line: string): { text: string; style: string }[] {
    return [
        ...line.matchAll(
            /<span class="shiki-token"(?: style="([^"]*)")?>([^<]*)<\/span>/g,
        ),
    ].map((match) => ({ style: match[1] ?? "", text: decode(match[2] ?? "") }));
}

function decode(text: string): string {
    return text
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
}

function colorOf(line: string, text: string): string | undefined {
    return tokens(line).find((token) => token.text === text)?.style;
}

describe(
    "highlightLines",
    () => {
        it("returns one entry per source line", async () => {
            const lines = await highlightLines(
                "const a = 1;\nconst b = 2;",
                "ts",
            );
            expect(lines).toHaveLength(2);
            expect(lines?.[0]).toContain("const");
        });

        it("keeps a multi-line comment one colour across its lines", async () => {
            const lines = await highlightLines(
                [
                    "/**",
                    " * Refreshes the account row; default and in the UI.",
                    " * Skipping the input fetch when the window is old.",
                    " */",
                    "export const x = 1;",
                ].join("\n"),
                "typescript",
            );
            expect(lines).toHaveLength(5);

            const commentStyle = tokens(lines?.[0] ?? "")[0]?.style;
            expect(commentStyle).toBeDefined();
            for (const index of [1, 2, 3]) {
                const styles = tokens(lines?.[index] ?? "").map(
                    (token) => token.style,
                );
                expect(styles.length).toBeGreaterThan(0);
                // Comment words like `default` and `window` keep the comment
                // colour instead of picking up a code token colour.
                expect(new Set(styles)).toEqual(new Set([commentStyle]));
            }
            // Code after the comment still highlights.
            expect(tokens(lines?.[4] ?? "").length).toBeGreaterThan(1);
        });

        it("marks async on an arrow function as a keyword", async () => {
            const [line] =
                (await highlightLines(
                    'setup("authenticate", async ({ browser }) => {',
                    "javascript",
                )) ?? [];

            const async = colorOf(line ?? "", "async");
            expect(async).toBeDefined();
            // Same colour as another keyword (`=>`), not the function name.
            expect(async).toBe(colorOf(line ?? "", "=>"));
            expect(async).not.toBe(colorOf(line ?? "", "setup"));
        });

        it("escapes markup in the source", async () => {
            const [line] =
                (await highlightLines(
                    '<img src=x onerror="alert(1)">',
                    "html",
                )) ?? [];

            expect(line).toContain("&lt;");
            expect(line).not.toContain("<img");
        });

        it("resolves aliases and file extensions", async () => {
            for (const tag of ["ts", "tsx", "js", "py", "rs", "yml", "md"]) {
                expect(await highlightLines("x", tag)).not.toBeNull();
            }
        });

        it("returns null for a tag shiki has no grammar for", async () => {
            expect(
                await highlightLines("x", "definitelynotalanguage"),
            ).toBeNull();
        });
    },
    TIMEOUT,
);
