// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "../markdown-renderer";

function renderList(content: string) {
    return render(<MarkdownRenderer content={content} />).container;
}

describe("markdown list margins", () => {
    it("renders ul and ol without top/bottom margin", () => {
        const container = renderList(
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
        const container = renderList(
            ["- [ ] todo", "- [x] done", ""].join("\n"),
        );

        const ul = container.querySelector("ul");
        expect(ul?.getAttribute("style")).toContain("margin-top: 0px");
        expect(ul?.getAttribute("style")).toContain("margin-bottom: 0px");
        expect(ul?.getAttribute("style")).toContain("padding-left: 0px");
    });

    it("applies the same reset to nested lists", () => {
        const container = renderList(
            ["- outer", "  - inner one", "  - inner two", ""].join("\n"),
        );

        const nested = container.querySelector("ul ul");
        expect(nested).not.toBeNull();
        expect((nested as HTMLElement).style.marginTop).toBe("0px");
        expect((nested as HTMLElement).style.marginBottom).toBe("0px");
    });
});
