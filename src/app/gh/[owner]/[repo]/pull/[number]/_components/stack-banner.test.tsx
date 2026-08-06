// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "~/components/ui/tooltip";
import type { StackSuggestion } from "~/server/github";
import { StackBanner } from "./stack-banner";
import { StackCreateBadge } from "./stack-create-badge";

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

function renderBanner(onDismiss: () => void, onCreateStack: () => void) {
    return render(
        <TooltipProvider>
            <StackBanner
                suggestion={suggestion}
                onDismiss={onDismiss}
                onCreateStack={onCreateStack}
            />
        </TooltipProvider>,
    );
}

describe("StackBanner", () => {
    it("shows the suggestion label and a Create stack button", () => {
        renderBanner(vi.fn(), vi.fn());
        expect(
            screen.getByText("Stack this pull request on #10?"),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Create stack" }),
        ).toBeInTheDocument();
    });

    it("dismisses the banner when the X button is clicked", async () => {
        const user = userEvent.setup();
        const onDismiss = vi.fn();
        renderBanner(onDismiss, vi.fn());
        await user.click(
            screen.getByRole("button", { name: "Dismiss stack suggestion" }),
        );
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("opens the create stack dialog via the Create stack button", async () => {
        const user = userEvent.setup();
        const onCreateStack = vi.fn();
        renderBanner(vi.fn(), onCreateStack);
        await user.click(screen.getByRole("button", { name: "Create stack" }));
        expect(onCreateStack).toHaveBeenCalledTimes(1);
    });
});

describe("StackCreateBadge", () => {
    it("shows a layers-plus icon in place of the stack badge", () => {
        const { container } = render(
            <TooltipProvider>
                <StackCreateBadge onClick={vi.fn()} />
            </TooltipProvider>,
        );
        expect(container.querySelector(".lucide-layers-plus")).not.toBeNull();
    });

    it("opens the create stack dialog when clicked", async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        render(
            <TooltipProvider>
                <StackCreateBadge onClick={onClick} />
            </TooltipProvider>,
        );
        await user.click(screen.getByRole("button", { name: "Create stack" }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
