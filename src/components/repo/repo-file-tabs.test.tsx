// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RepoFileTabs } from "./repo-file-tabs";

function renderTabs(active: "blob" | "blame", provider: "gh" | "cb" = "gh") {
    return render(
        <RepoFileTabs
            provider={provider}
            owner="o"
            repo="r"
            selectedRef="main"
            path="a.txt"
            active={active}
        />,
    );
}

describe("RepoFileTabs", () => {
    it("links Code and Blame and marks the active tab", () => {
        renderTabs("blame");

        const code = screen.getByRole("link", { name: "Code" });
        const blame = screen.getByRole("link", { name: "Blame" });

        expect(code).toHaveAttribute("href", "/gh/o/r/blob/main/a.txt");
        expect(blame).toHaveAttribute("href", "/gh/o/r/blame/main/a.txt");
        expect(blame).toHaveAttribute("aria-current", "page");
        expect(code).not.toHaveAttribute("aria-current");
    });

    it("marks Code active on the file view", () => {
        renderTabs("blob");

        expect(screen.getByRole("link", { name: "Code" })).toHaveAttribute(
            "aria-current",
            "page",
        );
    });

    it("renders nothing for Codeberg, which cannot blame", () => {
        const { container } = renderTabs("blob", "cb");

        expect(container).toBeEmptyDOMElement();
    });
});
