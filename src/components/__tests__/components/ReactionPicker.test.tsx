// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ReactionPicker } from "~/components/ReactionPicker";
import { ALL_REACTIONS } from "~/lib/reactions";

vi.mock("~/components/ui/popover", () => ({
    Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
    PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    PopoverContent: ({
        children,
        className,
    }: {
        children: ReactNode;
        className?: string;
    }) => (
        <div data-testid="popover-content" className={className}>
            {children}
        </div>
    ),
}));

vi.mock("lucide-react", () => ({
    SmilePlus: () => <div data-testid="smile-plus" />,
}));

const DEFAULT_PROPS = {
    reactions: [],
    currentUserLogin: "testuser" as string | null | undefined,
    onReact: vi.fn(),
};

describe("ReactionPicker", () => {
    it("shows all reactions when user hasn't reacted", () => {
        render(<ReactionPicker {...DEFAULT_PROPS} />);

        expect(
            screen.getByRole("button", { name: "Add reaction" }),
        ).toBeInTheDocument();
        ALL_REACTIONS.forEach((content) => {
            expect(
                screen.getByRole("button", { name: content }),
            ).toBeInTheDocument();
        });
    });

    it("shows only reactions user hasn't given", () => {
        const userReactions = [
            { content: "+1", user: { login: "testuser" } },
            { content: "heart", user: { login: "testuser" } },
        ];
        render(<ReactionPicker {...DEFAULT_PROPS} reactions={userReactions} />);

        expect(
            screen.queryByRole("button", { name: "+1" }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "heart" }),
        ).not.toBeInTheDocument();

        const remaining = ALL_REACTIONS.filter(
            (c) => c !== "+1" && c !== "heart",
        );
        remaining.forEach((content) => {
            expect(
                screen.getByRole("button", { name: content }),
            ).toBeInTheDocument();
        });
    });

    it("does not hide reactions given by other users", () => {
        render(
            <ReactionPicker
                {...DEFAULT_PROPS}
                reactions={[{ content: "+1", user: { login: "otheruser" } }]}
            />,
        );

        expect(screen.getByRole("button", { name: "+1" })).toBeInTheDocument();
    });

    it("returns null when all reactions used by current user", () => {
        const allReactions = ALL_REACTIONS.map((c) => ({
            content: c,
            user: { login: "testuser" },
        }));
        const { container } = render(
            <ReactionPicker {...DEFAULT_PROPS} reactions={allReactions} />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    it("handles null currentUserLogin gracefully", () => {
        render(<ReactionPicker {...DEFAULT_PROPS} currentUserLogin={null} />);

        expect(
            screen.getByRole("button", { name: "Add reaction" }),
        ).toBeInTheDocument();

        // No reaction buttons should appear inside the popover
        expect(
            screen.queryByRole("button", { name: "+1" }),
        ).not.toBeInTheDocument();
        expect(screen.queryByTestId("popover-content")).not.toBeInTheDocument();
    });

    it("handles undefined currentUserLogin gracefully", () => {
        render(
            <ReactionPicker
                reactions={[]}
                onReact={vi.fn()}
                currentUserLogin={undefined}
            />,
        );

        expect(
            screen.getByRole("button", { name: "Add reaction" }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "+1" }),
        ).not.toBeInTheDocument();
    });

    it("handles disabled prop gracefully", () => {
        render(<ReactionPicker {...DEFAULT_PROPS} disabled />);

        expect(
            screen.getByRole("button", { name: "Add reaction" }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "+1" }),
        ).not.toBeInTheDocument();
    });

    it("clicking a reaction button calls onReact with correct content", async () => {
        const onReact = vi.fn();
        const user = userEvent.setup();
        render(<ReactionPicker {...DEFAULT_PROPS} onReact={onReact} />);

        await user.click(screen.getByRole("button", { name: "+1" }));
        expect(onReact).toHaveBeenCalledWith("+1");
    });
});
