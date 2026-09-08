// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "../markdown-renderer";

const badges = [
    "[![CI](https://img.shields.io/ci.svg)](https://example.com/ci)",
    "[![Crates.io](https://img.shields.io/crates.svg)](https://example.com/crates)",
    "[![MIT licensed](https://img.shields.io/mit.svg)](https://example.com/license)",
].join("\n");

describe("markdown soft line breaks", () => {
    it("breaks single newlines for comment bodies", () => {
        const { container } = render(
            <MarkdownRenderer content={["foo", "bar"].join("\n")} />,
        );

        expect(container.querySelectorAll("br")).toHaveLength(1);
    });

    it("collapses single newlines when hard breaks are disabled", () => {
        const { container } = render(
            <MarkdownRenderer
                content={["foo", "bar"].join("\n")}
                hardLineBreaks={false}
            />,
        );

        expect(container.querySelectorAll("br")).toHaveLength(0);
        // The DOM keeps the source newline; CSS collapses it to a space.
        expect(container.querySelector("p")?.textContent).toBe("foo\nbar");
    });

    it("keeps consecutive badge links on one line in markdown files", () => {
        const { container } = render(
            <MarkdownRenderer content={badges} hardLineBreaks={false} />,
        );

        const paragraphs = container.querySelectorAll("p");
        expect(paragraphs).toHaveLength(1);
        expect(container.querySelectorAll("br")).toHaveLength(0);
        expect(paragraphs[0]?.querySelectorAll("img")).toHaveLength(3);
    });
});
