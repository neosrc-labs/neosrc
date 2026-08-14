import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "../markdown-renderer";

function renderMarkdown(content: string) {
    return render(<MarkdownRenderer content={content} />).container;
}

describe("markdown image rendering", () => {
    it("keeps explicit width and height attributes on images", () => {
        const container = renderMarkdown(
            '<img src="https://example.com/rust.svg" width="50%" alt="Rust">',
        );
        const img = container.querySelector("img");
        expect(img?.getAttribute("width")).toBe("50%");
        expect(img?.getAttribute("alt")).toBe("Rust");
    });

    it("keeps alt and title on markdown images", () => {
        const container = renderMarkdown(
            '![Rust logo](https://example.com/rust.svg "The Rust logo")',
        );
        const img = container.querySelector("img");
        expect(img?.getAttribute("alt")).toBe("Rust logo");
        expect(img?.getAttribute("title")).toBe("The Rust logo");
    });

    it("renders picture theme sources with media queries intact", () => {
        const container = renderMarkdown(
            [
                "<picture>",
                '<source media="(prefers-color-scheme: dark)" srcset="dark.svg">',
                '<source media="(prefers-color-scheme: light)" srcset="light.svg">',
                '<img src="light.svg" alt="logo">',
                "</picture>",
            ].join(""),
        );
        const sources = container.querySelectorAll("picture source");
        expect(sources).toHaveLength(2);
        expect(sources[0]?.getAttribute("media")).toBe(
            "(prefers-color-scheme: dark)",
        );
        expect(sources[1]?.getAttribute("media")).toBe(
            "(prefers-color-scheme: light)",
        );
    });

    it("does not cap image height to a fixed size", () => {
        const container = renderMarkdown(
            "![Rust logo](https://example.com/rust.svg)",
        );
        const img = container.querySelector("img");
        expect(img?.className).not.toContain("max-h");
    });
});
