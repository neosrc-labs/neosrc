// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "../markdown-renderer";

function renderMarkdown(content: string) {
    return render(<MarkdownRenderer content={content} />).container;
}

describe("markdown list margins", () => {
    it("renders ul and ol without top/bottom margin", () => {
        const container = renderMarkdown(
            ["- one", "- two", "", "1. first", "2. second", ""].join("\n"),
        );

        const lists = container.querySelectorAll("ul, ol");
        expect(lists.length).toBeGreaterThanOrEqual(2);
        for (const list of lists) {
            const style = (list as HTMLElement).style;
            expect(style.marginTop).toBe("0px");
            expect(style.marginBottom).toBe("0px");
        }
    });

    it("keeps task list indentation reset and no vertical margin", () => {
        const container = renderMarkdown(
            ["- [ ] todo", "- [x] done", ""].join("\n"),
        );

        const ul = container.querySelector("ul");
        expect(ul?.getAttribute("style")).toContain("margin-top: 0px");
        expect(ul?.getAttribute("style")).toContain("margin-bottom: 0px");
        expect(ul?.getAttribute("style")).toContain("padding-left: 0px");
    });

    it("applies the same reset to nested lists", () => {
        const container = renderMarkdown(
            ["- outer", "  - inner one", "  - inner two", ""].join("\n"),
        );

        const nested = container.querySelector("ul ul");
        expect(nested).not.toBeNull();
        expect((nested as HTMLElement).style.marginTop).toBe("0px");
        expect((nested as HTMLElement).style.marginBottom).toBe("0px");
    });
});

describe("markdown section break margin", () => {
    it("renders hr with 24px top/bottom margin instead of the prose default", () => {
        const container = renderMarkdown(
            ["before", "", "---", "", "after", ""].join("\n"),
        );

        const hr = container.querySelector("hr");
        expect(hr).not.toBeNull();
        expect((hr as HTMLElement).style.marginTop).toBe("24px");
        expect((hr as HTMLElement).style.marginBottom).toBe("24px");
    });
});

describe("markdown heading ids", () => {
    it("suffixes duplicate headings within one document", () => {
        const container = render(
            <MarkdownRenderer
                content={["## Setup", "## Setup", ""].join("\n")}
                linkableHeadings
            />,
        ).container;

        const ids = [...container.querySelectorAll("h2")].map((h) => h.id);
        expect(ids).toEqual(["setup", "setup-1"]);
    });

    it("resets slug counters when content changes without a remount", () => {
        const { container, rerender } = render(
            <MarkdownRenderer
                content={["## Setup", "## Setup", ""].join("\n")}
                linkableHeadings
            />,
        );
        expect([...container.querySelectorAll("h2")].map((h) => h.id)).toEqual([
            "setup",
            "setup-1",
        ]);

        rerender(<MarkdownRenderer content="## Setup" linkableHeadings />);
        expect([...container.querySelectorAll("h2")].map((h) => h.id)).toEqual([
            "setup",
        ]);

        // A later pass must not inherit counters from earlier documents.
        rerender(
            <MarkdownRenderer
                content={["## Notes", "## Setup", ""].join("\n")}
                linkableHeadings
            />,
        );
        const ids = [...container.querySelectorAll("h2")].map((h) => h.id);
        expect(ids).toEqual(["notes", "setup"]);
    });
});
