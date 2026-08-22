// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

describe("code block copy button", () => {
    it("renders a copy button over the top-right of a fenced code block", () => {
        const container = renderCode(
            ["```ts", "const x = 1;", "```"].join("\n"),
        );

        const button = screen.getByRole("button", { name: "Copy code" });
        const pre = container.querySelector("pre");

        expect(button).not.toBeNull();
        expect(pre?.parentElement?.className).toContain("relative");
        expect(button.className).toContain("absolute");
        expect(button.className).toContain("top-1.5");
        expect(button.className).toContain("right-1.5");
        // The button is a sibling of the highlighted block, not part of it.
        expect(pre?.contains(button)).toBe(false);
    });

    it("copies the code text on click and shows a copied state", async () => {
        const writeText = vi
            .fn<typeof navigator.clipboard.writeText>()
            .mockResolvedValue(undefined);
        // fireEvent (not userEvent): userEvent.setup() replaces
        // navigator.clipboard with its own stub, which would swallow the call.
        Object.assign(navigator, {
            clipboard: { writeText },
        });

        renderCode(
            ["```rust", "fn main() {", '    println!("hi");', "}", "```"].join(
                "\n",
            ),
        );

        fireEvent.click(screen.getByRole("button", { name: "Copy code" }));

        expect(writeText).toHaveBeenCalledWith(
            'fn main() {\n    println!("hi");\n}\n',
        );
        expect(
            await screen.findByRole("button", { name: "Copied" }),
        ).toBeDefined();
    });
});
