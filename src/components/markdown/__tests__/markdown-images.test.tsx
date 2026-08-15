import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "../markdown-renderer";

function renderMarkdown(
    content: string,
    props: {
        imageBaseUrl?: string;
        imageDocDir?: string;
        proseSize?: "sm" | "base";
    } = {},
) {
    return render(<MarkdownRenderer content={content} {...props} />).container;
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

    it("keeps the align attribute so aligned images float like GitHub", () => {
        const container = renderMarkdown(
            '<img src="https://example.com/sticker.png" align="right" width="200px" alt="sticker">',
        );
        const img = container.querySelector("img");
        expect(img?.getAttribute("align")).toBe("right");
        expect(img?.getAttribute("width")).toBe("200px");
    });

    it("defaults to base prose but can render at sm size", () => {
        const base = renderMarkdown("text");
        expect(base.querySelector(".prose")?.className).not.toContain(
            "prose-sm",
        );
        const sm = renderMarkdown("text", { proseSize: "sm" });
        expect(sm.querySelector(".prose")?.className).toContain("prose-sm");
    });

    it("renders single newlines as hard breaks in paragraphs", () => {
        const container = renderMarkdown("line one\nline two\nline three");
        expect(container.querySelectorAll("br")).toHaveLength(2);
    });

    it("flows bullet continuations instead of hard-breaking them", () => {
        const container = renderMarkdown(
            [
                "* out-of-bounds memory accesses",
                "  and use-after-free",
                "* invalid use of uninitialized data",
            ].join("\n"),
        );
        expect(container.querySelector("ul br")).toBeNull();
        // The same newlines in a paragraph still hard-break.
        const paragraph = renderMarkdown("foo\nbar");
        expect(paragraph.querySelector("br")).not.toBeNull();
    });
});

describe("relative image resolution", () => {
    const base = "https://raw.githubusercontent.com/acme/widget/main";

    it("resolves dot-slash and bare relative paths against the base URL", () => {
        const container = renderMarkdown(
            "![logo](./images/logo.png)\n\n![icon](icon.svg)",
            { imageBaseUrl: base },
        );
        const srcs = [...container.querySelectorAll("img")].map((img) =>
            img.getAttribute("src"),
        );
        expect(srcs).toEqual([`${base}/images/logo.png`, `${base}/icon.svg`]);
    });

    it("normalizes parent-directory segments against the doc directory", () => {
        const container = renderMarkdown("![logo](../assets/logo.svg)", {
            imageBaseUrl: base,
            imageDocDir: "docs",
        });
        expect(container.querySelector("img")?.getAttribute("src")).toBe(
            `${base}/assets/logo.svg`,
        );
    });

    it("clamps parent segments at the repo root", () => {
        const container = renderMarkdown("![logo](../../assets/logo.svg)", {
            imageBaseUrl: base,
        });
        expect(container.querySelector("img")?.getAttribute("src")).toBe(
            `${base}/assets/logo.svg`,
        );
    });

    it("leaves absolute, root-relative, and protocol-relative URLs untouched", () => {
        const container = renderMarkdown(
            [
                "![abs](https://example.com/a.png)",
                "![root](/a.png)",
                "![proto](//example.com/a.png)",
            ].join("\n"),
            { imageBaseUrl: base },
        );
        const srcs = [...container.querySelectorAll("img")].map((img) =>
            img.getAttribute("src"),
        );
        expect(srcs).toEqual([
            "https://example.com/a.png",
            "/a.png",
            "//example.com/a.png",
        ]);
    });

    it("resolves raw HTML img srcs as well", () => {
        const container = renderMarkdown(
            '<img src="./assets/logo.svg" alt="logo">',
            { imageBaseUrl: base },
        );
        expect(container.querySelector("img")?.getAttribute("src")).toBe(
            `${base}/assets/logo.svg`,
        );
    });

    it("leaves relative images untouched when no base URL is provided", () => {
        const container = renderMarkdown("![logo](./images/logo.png)");
        expect(container.querySelector("img")?.getAttribute("src")).toBe(
            "./images/logo.png",
        );
    });
});
