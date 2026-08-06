// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "~/components/ui/tooltip";
import { StackBadge } from "./stack-popover";

const mockUseGetStackQuery = vi.hoisted(() => vi.fn());
const mockUseUnstackMutation = vi.hoisted(() => vi.fn());

vi.mock("~/trpc/react", () => ({
    api: {
        useUtils: vi.fn(() => ({
            pulls: {
                getStack: { invalidate: vi.fn() },
                list: { invalidate: vi.fn() },
            },
        })),
        pulls: {
            getStack: { useQuery: mockUseGetStackQuery },
            unstack: { useMutation: mockUseUnstackMutation },
        },
    },
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: vi.fn() }),
}));

const stackData = {
    number: 7,
    baseRef: "main",
    pullRequests: [
        {
            number: 7,
            state: "open" as const,
            draft: false,
            title: "feature-a",
            headRef: "main",
        },
        {
            number: 8,
            state: "open" as const,
            draft: false,
            title: "feature-b",
            headRef: "feature-a",
        },
    ],
};

function badgeElement() {
    return (
        <TooltipProvider>
            <StackBadge
                owner="test-owner"
                repo="test-repo"
                stack={{ size: 2, position: 2, number: 7 }}
                prNumber={8}
            />
        </TooltipProvider>
    );
}

function renderBadge() {
    return render(badgeElement());
}

async function openConfirmDialog(user: UserEvent) {
    await user.click(screen.getByRole("button", { name: "2 / 2" }));
    await user.click(
        screen.getByRole("button", { name: "Unstack pull requests" }),
    );
}

describe("StackBadge unstack flow", () => {
    beforeEach(() => {
        mockUseGetStackQuery.mockReturnValue({
            data: stackData,
            isLoading: false,
        });
        mockUseUnstackMutation.mockReturnValue({
            isPending: false,
            isError: false,
            mutate: vi.fn(),
        });
    });

    it("shows no spinner on the unstack button when idle", async () => {
        const user = userEvent.setup();
        renderBadge();
        await openConfirmDialog(user);
        expect(document.querySelector(".animate-spin")).toBeNull();
    });

    it("shows a spinner on the unstack button while the stack is being deleted", async () => {
        const user = userEvent.setup();
        const { rerender } = renderBadge();
        await openConfirmDialog(user);
        mockUseUnstackMutation.mockReturnValue({
            isPending: true,
            isError: false,
            mutate: vi.fn(),
        });
        rerender(badgeElement());
        const button = screen.getByRole("button", { name: "Unstack" });
        expect(button).toBeDisabled();
        expect(document.querySelector(".animate-spin")).not.toBeNull();
    });
});
