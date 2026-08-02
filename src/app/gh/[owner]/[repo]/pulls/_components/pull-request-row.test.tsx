// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "~/components/ui/tooltip";
import { type PrRowData, PullRequestRow } from "./pull-request-row";

const basePr: PrRowData = {
    id: 1,
    number: 42,
    title: "Add feature",
    state: "open",
    draft: false,
    user: null,
    assignee: null,
    labels: [],
    created_at: "2026-01-01T00:00:00Z",
    merged_at: null,
    comments_count: 0,
    status_state: null,
    status_contexts: [],
    review_decision: null,
    stack: null,
};

function renderRow(pr: PrRowData) {
    return render(
        <TooltipProvider>
            <PullRequestRow pr={pr} owner="test-owner" repo="test-repo" />
        </TooltipProvider>,
    );
}

describe("PullRequestRow", () => {
    it("shows the stack icon and position when the PR is part of a stack", () => {
        const { container } = renderRow({
            ...basePr,
            stack: { size: 4, position: 2 },
        });
        expect(container.querySelector(".lucide-layers")).not.toBeNull();
        expect(screen.getByText("2 / 4")).toBeInTheDocument();
    });

    it("hides the stack icon when the PR is not part of a stack", () => {
        const { container } = renderRow({ ...basePr, stack: null });
        expect(container.querySelector(".lucide-layers")).toBeNull();
        expect(screen.queryByText("/")).toBeNull();
    });
});
