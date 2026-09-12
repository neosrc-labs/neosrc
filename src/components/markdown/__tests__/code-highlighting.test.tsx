// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarkdownRenderer } from "../markdown-renderer";

function renderCode(content: string) {
    return render(<MarkdownRenderer content={content} />).container;
}

describe("fenced code highlighting", () => {
    it("emits the hljs tokens the diff views style", () => {
        const container = renderCode(
            [
                "```js",
                "// a comment",
                "const n = 42;",
                'const s = "hi";',
                "```",
            ].join("\n"),
        );

        const code = container.querySelector("code.language-js");
        expect(code).not.toBeNull();
        // The diff and review-thread views highlight with the same library and
        // token classes, so these resolve to the same theme CSS.
        expect(code?.querySelector(".hljs-comment")?.textContent).toBe(
            "// a comment",
        );
        expect(code?.querySelector(".hljs-keyword")?.textContent).toBe("const");
        expect(code?.querySelector(".hljs-number")?.textContent).toBe("42");
        expect(code?.querySelector(".hljs-string")?.textContent).toBe('"hi"');

        expect(container.querySelector("pre")?.className).toContain(
            "bg-surface-tertiary",
        );
    });

    it("renders an unknown language as plain text", () => {
        const container = renderCode(
            ["```definitelynotalanguage", "no tokens here", "```"].join("\n"),
        );

        const code = container.querySelector("code");
        expect(code?.textContent?.trim()).toBe("no tokens here");
        expect(code?.querySelector("span")).toBeNull();
    });

    it("escapes code content instead of rendering it", () => {
        const container = renderCode(
            ["```html", "<img src=x onerror=alert(1)>", "```"].join("\n"),
        );

        expect(container.querySelector("img")).toBeNull();
        expect(container.querySelector("code")?.textContent).toContain(
            "<img src=x onerror=alert(1)>",
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
