// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "../markdown-renderer";

function renderCode(content: string) {
    return render(<MarkdownRenderer content={content} />).container;
}

// jsdom serializes inline colors as rgb().
function tokenColors(container: Element) {
    const colors = new Map<string, string>();
    for (const span of container.querySelectorAll("code span[style]")) {
        const style = span.getAttribute("style") ?? "";
        const color = style.match(/color:\s*([^;]+)/)?.[1]?.trim();
        if (color) {
            colors.set(color, (colors.get(color) ?? "") + span.textContent);
        }
    }
    return colors;
}

describe("syntax highlighting theme", () => {
    it("applies the app-matched light theme to fenced code tokens", () => {
        const container = renderCode(
            [
                "```js",
                "// a comment",
                "const n = 42;",
                "function greet(name) {",
                '  return "hello " + name;',
                "}",
                "```",
            ].join("\n"),
        );

        const code = container.querySelector("code.language-javascript");
        expect(code).not.toBeNull();

        const colors = tokenColors(container);
        // comments -> --color-text-tertiary
        expect(colors.get("rgb(107, 114, 128)")).toContain("a comment");
        // keywords (const, function, return) -> --color-state-merged
        expect(colors.get("rgb(124, 58, 237)")).toContain("const");
        expect(colors.get("rgb(124, 58, 237)")).toContain("function");
        expect(colors.get("rgb(124, 58, 237)")).toContain("return");
        // numbers -> --color-state-queued
        expect(colors.get("rgb(161, 98, 7)")).toContain("42");
        // strings -> green-700
        expect(colors.get("rgb(21, 128, 61)")).toContain("hello ");
        // base text -> --color-text-primary
        expect(container.querySelector("pre")?.getAttribute("style")).toContain(
            "rgb(17, 24, 39)",
        );
    });

    it("keeps the code block background on the app's tertiary surface", () => {
        const container = renderCode(
            ["```rust", "fn main() {}", "```"].join("\n"),
        );
        const pre = container.querySelector("pre");
        expect(pre?.getAttribute("style")).toContain(
            "--color-surface-tertiary",
        );
    });
});
