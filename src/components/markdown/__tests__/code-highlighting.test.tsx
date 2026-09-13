// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownRenderer } from "../markdown-renderer";

vi.mock("~/utils/highlight", () => ({
    highlightLines: vi.fn(async (code: string, tag: string) =>
        tag === "definitelynotalanguage"
            ? null
            : code
                  .split("\n")
                  .map(
                      (line) =>
                          `<span class="shiki-token" style="--shiki-light:#111;--shiki-dark:#eee">${line}</span>`,
                  ),
    ),
}));

import { highlightLines } from "~/utils/highlight";

function renderCode(content: string) {
    return render(<MarkdownRenderer content={content} />).container;
}

describe("fenced code highlighting", () => {
    beforeEach(() => {
        vi.mocked(highlightLines).mockClear();
    });

    it("tokenizes fenced code and keeps the block surface", async () => {
        const container = renderCode(
            ["```js", "const n = 42;", "```"].join("\n"),
        );

        const code = await vi.waitFor(() => {
            const element = container.querySelector("code.language-js");
            if (!element?.querySelector(".shiki-token")) {
                throw new Error("code block not highlighted yet");
            }
            return element;
        });

        expect(code.querySelector(".shiki-token")?.textContent).toBe(
            "const n = 42;",
        );
        expect(container.querySelector("pre")?.className).toContain(
            "bg-surface-tertiary",
        );
    });

    it("drops the previous block's markup while new code is pending", async () => {
        const { container, rerender } = render(
            <MarkdownRenderer content={"```js\nconst a = 1;\n```"} />,
        );
        await vi.waitFor(() =>
            expect(container.querySelector(".shiki-token")).not.toBeNull(),
        );

        let release: (lines: string[] | null) => void = () => {};
        vi.mocked(highlightLines).mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    release = resolve;
                }),
        );

        rerender(<MarkdownRenderer content={"```js\nconst b = 2;\n```"} />);

        // While the new request is pending, the previous block's tokens must
        // not linger over the new code.
        expect(container.querySelector("code")?.textContent).toContain(
            "const b = 2;",
        );
        expect(container.querySelector(".shiki-token")).toBeNull();

        release(['<span class="shiki-token">const b = 2;</span>']);
        await vi.waitFor(() =>
            expect(container.querySelector(".shiki-token")?.textContent).toBe(
                "const b = 2;",
            ),
        );
    });

    it("falls back to plain text when shiki has no grammar", async () => {
        const container = renderCode(
            ["```definitelynotalanguage", "no tokens here", "```"].join("\n"),
        );

        await vi.waitFor(() => {
            expect(vi.mocked(highlightLines)).toHaveBeenCalledWith(
                expect.stringContaining("no tokens here"),
                "definitelynotalanguage",
            );
        });

        expect(container.querySelector(".shiki-token")).toBeNull();
        expect(container.querySelector("code")?.textContent).toContain(
            "no tokens here",
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
