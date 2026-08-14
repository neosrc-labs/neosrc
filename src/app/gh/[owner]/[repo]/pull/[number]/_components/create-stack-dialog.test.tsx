// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STACK_SUGGESTION } from "~/__tests__/helpers/stack-suggestion";
import { pullsStackUtils } from "~/__tests__/helpers/trpc-mocks";
import { CreateStackDialog } from "./create-stack-dialog";

const mockUseCreateStackMutation = vi.hoisted(() => vi.fn());

vi.mock("~/trpc/react", () => ({
    api: {
        ...pullsStackUtils(),
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

function renderDialog() {
    return render(
        <CreateStackDialog
            open
            onOpenChange={vi.fn()}
            owner="test-owner"
            repo="test-repo"
            suggestion={STACK_SUGGESTION}
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
