import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownRenderer } from "./markdown-renderer";

const renderMock = vi.hoisted(() =>
    vi.fn(async () => ({ svg: "<svg><g>diagram</g></svg>" })),
);

vi.mock("mermaid", () => ({
    default: {
        initialize: vi.fn(),
        render: renderMock,
    },
}));

vi.mock("next-themes", () => ({
    useTheme: () => ({ resolvedTheme: "light" }),
}));

function renderMarkdown(content: string) {
    return render(<MarkdownRenderer content={content} />).container;
}

describe("mermaid rendering", () => {
    beforeEach(() => {
        renderMock.mockClear();
        renderMock.mockImplementation(async () => ({
            svg: "<svg><g>diagram</g></svg>",
        }));
    });

    it("renders a mermaid code block as a diagram instead of source code", async () => {
        const source = "graph TD;\n    A --> B;";
        const container = renderMarkdown(
            ["```mermaid", source, "```"].join("\n"),
        );
        await waitFor(() => {
            expect(container.textContent).toContain("diagram");
        });
        expect(renderMock).toHaveBeenCalledWith(expect.any(String), source);
        expect(container.querySelector("pre")).toBeNull();
    });

    it("shows the source with an error note when the diagram fails to parse", async () => {
        renderMock.mockRejectedValue(new Error("Parse error"));
        const source = "graph TD;\n    A --> ;";
        const container = renderMarkdown(
            ["```mermaid", source, "```"].join("\n"),
        );
        await waitFor(() => {
            expect(container.textContent).toContain(
                "Mermaid diagram failed to render",
            );
        });
        expect(container.querySelector("pre")?.textContent).toContain(source);
        expect(container.querySelector("svg")).toBeNull();
    });

    it("does not hijack non-mermaid code blocks", () => {
        const container = renderMarkdown(
            ["```ts", "const x = 1;", "```"].join("\n"),
        );
        expect(container.querySelector("pre code")).not.toBeNull();
        expect(container.textContent).not.toContain("diagram");
    });
});
