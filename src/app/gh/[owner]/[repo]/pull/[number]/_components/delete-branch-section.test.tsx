// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TIMELINE_PAGE_SIZE } from "~/lib/timeline-constants";
import { DeleteBranchSection } from "./delete-branch-section";

const mocks = vi.hoisted(() => ({
    deleteBranchMutate: vi.fn(),
    invalidateTimeline: vi.fn(),
}));

vi.mock("~/trpc/react", () => ({
    api: {
        useUtils: () => ({
            timeline: {
                list: {
                    invalidate: mocks.invalidateTimeline,
                },
            },
        }),
        pulls: {
            deleteBranch: {
                useMutation: (opts?: { onSuccess?: () => void }) => ({
                    mutate: (args: unknown) => {
                        mocks.deleteBranchMutate(args);
                        opts?.onSuccess?.();
                    },
                    isPending: false,
                    isError: false,
                }),
            },
        },
    },
}));

function renderSection({
    merged = false,
    canDelete = true,
}: {
    merged?: boolean;
    canDelete?: boolean;
} = {}) {
    render(
        <DeleteBranchSection
            branchHref="https://github.com/owner/repo/tree/feature/foo"
            branchLabel="feature/foo"
            canDelete={canDelete}
            merged={merged}
            number={1}
            owner="owner"
            repo="repo"
        />,
    );
}

describe("DeleteBranchSection", () => {
    it("shows the merged message and branch link when merged", () => {
        renderSection({ merged: true });

        expect(
            screen.getByText("Pull request successfully merged and closed"),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "feature/foo" }),
        ).toHaveAttribute(
            "href",
            "https://github.com/owner/repo/tree/feature/foo",
        );
    });

    it("shows the closed message when not merged", () => {
        renderSection();

        expect(
            screen.getByText("Closed with unmerged commits"),
        ).toBeInTheDocument();
    });

    it("hides the button when the user cannot delete", () => {
        renderSection({ canDelete: false });

        expect(
            screen.queryByRole("button", { name: "Delete branch" }),
        ).not.toBeInTheDocument();
    });

    it("deletes the branch on click", async () => {
        renderSection();

        await userEvent.click(
            screen.getByRole("button", { name: "Delete branch" }),
        );

        expect(mocks.deleteBranchMutate).toHaveBeenCalledWith({
            owner: "owner",
            repo: "repo",
            number: 1,
        });
    });

    it("invalidates the timeline after deleting", async () => {
        renderSection();

        await userEvent.click(
            screen.getByRole("button", { name: "Delete branch" }),
        );

        expect(mocks.invalidateTimeline).toHaveBeenCalledWith({
            owner: "owner",
            repo: "repo",
            number: 1,
            limit: TIMELINE_PAGE_SIZE,
        });
    });
});
