// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StackSuggestion } from "~/server/github";
import { CreateStackDialog } from "./create-stack-dialog";

const mockUseCreateStackMutation = vi.hoisted(() => vi.fn());

vi.mock("~/trpc/react", () => ({
    api: {
        useUtils: vi.fn(() => ({
            pulls: {
                getStack: { invalidate: vi.fn() },
                list: { invalidate: vi.fn() },
            },
        })),
        pulls: {
            createStack: {
                useMutation: mockUseCreateStackMutation,
            },
        },
    },
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: vi.fn() }),
}));

const suggestion: StackSuggestion = {
    pullRequests: [
        {
            number: 10,
            title: "feature-a",
            state: "open",
            draft: false,
            headRef: "main",
        },
        {
            number: 11,
            title: "feature-b",
            state: "open",
            draft: false,
            headRef: "feature-a",
        },
    ],
    baseRef: "main",
};

function renderDialog() {
    return render(
        <CreateStackDialog
            open
            onOpenChange={vi.fn()}
            owner="test-owner"
            repo="test-repo"
            suggestion={suggestion}
        />,
    );
}

describe("CreateStackDialog", () => {
    beforeEach(() => {
        mockUseCreateStackMutation.mockReturnValue({
            isPending: false,
            isError: false,
            mutate: vi.fn(),
        });
    });

    it("shows no spinner when idle", () => {
        renderDialog();
        expect(document.querySelector(".animate-spin")).toBeNull();
    });

    it("shows a spinner on the create button while the stack is being created", () => {
        mockUseCreateStackMutation.mockReturnValue({
            isPending: true,
            isError: false,
            mutate: vi.fn(),
        });
        renderDialog();
        const button = screen.getByRole("button", { name: "Create stack" });
        expect(button).toBeDisabled();
        expect(document.querySelector(".animate-spin")).not.toBeNull();
    });
});
