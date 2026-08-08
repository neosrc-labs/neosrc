// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReactionBar } from "~/components/reaction-bar";

vi.mock("~/components/ui/tooltip", () => ({
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
    TooltipContent: ({ children }: { children: React.ReactNode }) => (
        <span data-testid="tooltip-content">{children}</span>
    ),
}));

describe("ReactionBar", () => {
    it("groups reactions by content correctly", () => {
        const reactions = [
            { content: "+1", id: "1", user: { login: "alice" } },
            { content: "+1", id: "2", user: { login: "bob" } },
            { content: "heart", id: "3", user: { login: "carol" } },
        ];

        render(<ReactionBar reactions={reactions} onReact={vi.fn()} />);

        const buttons = screen.getAllByRole("button");
        expect(buttons).toHaveLength(2);
        expect(screen.getByLabelText("👍 (2)")).toBeInTheDocument();
        expect(screen.getByLabelText("❤️ (1)")).toBeInTheDocument();
    });

    it("applies REACTION_ORDER filtering", () => {
        const reactions = [
            { content: "-1", id: "1", user: { login: "alice" } },
            { content: "+1", id: "2", user: { login: "bob" } },
            { content: "invalid_reaction", id: "3", user: { login: "carol" } },
        ];

        render(<ReactionBar reactions={reactions} onReact={vi.fn()} />);

        const buttons = screen.getAllByRole("button");
        // invalid_reaction is not in REACTION_ORDER, so it's excluded
        expect(buttons).toHaveLength(2);
        // +1 is first in REACTION_ORDER, -1 is last
        expect(buttons[0]).toHaveAttribute(
            "aria-label",
            expect.stringContaining("👍"),
        );
        expect(buttons[1]).toHaveAttribute(
            "aria-label",
            expect.stringContaining("👎"),
        );
    });

    it("uses counts override when provided", () => {
        const reactions = [
            { content: "+1", id: "1", user: { login: "alice" } },
            { content: "+1", id: "2", user: { login: "bob" } },
        ];

        render(
            <ReactionBar
                reactions={reactions}
                counts={{ "+1": 5 }}
                onReact={vi.fn()}
            />,
        );

        // Count shows 5 from override, not 2 from array length
        expect(screen.getByLabelText("👍 (5)")).toBeInTheDocument();
    });

    it("hides reaction when counts override is zero", () => {
        const reactions = [
            { content: "heart", id: "1", user: { login: "alice" } },
        ];

        render(
            <ReactionBar
                reactions={reactions}
                counts={{ heart: 0 }}
                onReact={vi.fn()}
            />,
        );

        expect(screen.queryByLabelText(/❤️/)).not.toBeInTheDocument();
    });

    it("hides reaction not present in counts override", () => {
        const reactions = [
            { content: "heart", id: "1", user: { login: "alice" } },
            { content: "+1", id: "2", user: { login: "bob" } },
        ];

        render(
            <ReactionBar
                reactions={reactions}
                counts={{ "+1": 3 }}
                onReact={vi.fn()}
            />,
        );

        expect(screen.getByLabelText("👍 (3)")).toBeInTheDocument();
        // heart is absent from counts; (counts["heart"] ?? 0) === 0, so hidden
        expect(screen.queryByLabelText(/❤️/)).not.toBeInTheDocument();
    });

    it("highlights user's active reactions", () => {
        const reactions = [
            { content: "+1", id: "1", user: { login: "alice" } },
            { content: "+1", id: "2", user: { login: "bob" } },
            { content: "heart", id: "3", user: { login: "alice" } },
        ];

        render(
            <ReactionBar
                reactions={reactions}
                currentUserLogin="alice"
                onReact={vi.fn()}
            />,
        );

        expect(screen.getByLabelText(/👍/)).toHaveAttribute(
            "aria-pressed",
            "true",
        );
        expect(screen.getByLabelText(/❤️/)).toHaveAttribute(
            "aria-pressed",
            "true",
        );
    });

    it("does not highlight when user has no reaction", () => {
        const reactions = [
            { content: "+1", id: "1", user: { login: "alice" } },
        ];

        render(
            <ReactionBar
                reactions={reactions}
                currentUserLogin="bob"
                onReact={vi.fn()}
            />,
        );

        expect(screen.getByLabelText(/👍/)).toHaveAttribute(
            "aria-pressed",
            "false",
        );
    });

    it("renders up to 4 avatars for recent reactions", () => {
        const users = Array.from({ length: 6 }, (_, i) => ({
            content: "+1" as const,
            id: String(i + 1),
            user: {
                login: `user${i + 1}`,
                avatar_url: `/avatar${i + 1}.png`,
            },
        }));

        render(<ReactionBar reactions={users} onReact={vi.fn()} />);

        const imgs = screen.getAllByRole("img");
        expect(imgs).toHaveLength(4);
    });

    it("excludes current user from avatar list", () => {
        const reactions = [
            {
                content: "+1",
                id: "1",
                user: { login: "alice", avatar_url: "/alice.png" },
            },
            {
                content: "+1",
                id: "2",
                user: { login: "bob", avatar_url: "/bob.png" },
            },
        ];

        render(
            <ReactionBar
                reactions={reactions}
                currentUserLogin="alice"
                onReact={vi.fn()}
            />,
        );

        const imgs = screen.getAllByRole("img");
        expect(imgs).toHaveLength(1);
        expect(imgs[0]).toHaveAttribute(
            "src",
            expect.stringContaining("bob.png"),
        );
    });

    it("renders nothing for empty reactions", () => {
        render(<ReactionBar reactions={[]} onReact={vi.fn()} />);

        expect(screen.queryAllByRole("button")).toHaveLength(0);
    });

    it("calls onReact with reaction content on click", async () => {
        const onReact = vi.fn();
        const user = userEvent.setup();

        const reactions = [
            { content: "+1", id: "1", user: { login: "alice" } },
        ];

        render(<ReactionBar reactions={reactions} onReact={onReact} />);

        await user.click(screen.getByLabelText(/👍/));
        expect(onReact).toHaveBeenCalledWith("+1");
    });

    it("does not call onReact when disabled", async () => {
        const onReact = vi.fn();
        const user = userEvent.setup();

        const reactions = [
            { content: "+1", id: "1", user: { login: "alice" } },
        ];

        render(
            <ReactionBar reactions={reactions} onReact={onReact} disabled />,
        );

        await user.click(screen.getByLabelText(/👍/));
        expect(onReact).not.toHaveBeenCalled();
    });

    it("renders comma-separated logins in tooltip content", () => {
        const reactions = [
            { content: "+1", id: "1", user: { login: "alice" } },
            { content: "+1", id: "2", user: { login: "bob" } },
            {
                content: "heart",
                id: "3",
                user: { login: "carol", avatar_url: "/carol.png" },
            },
        ];

        render(<ReactionBar reactions={reactions} onReact={vi.fn()} />);

        expect(screen.getByText("alice, bob")).toBeInTheDocument();
        expect(screen.getByText("carol")).toBeInTheDocument();
    });

    it("does not render a tooltip when counts include a type with no reactors on the page", () => {
        // counts reports heart reactors, but the first page of reactions has
        // none of them, so the heart button would otherwise show an empty
        // tooltip.
        const reactions = [
            { content: "+1", id: "1", user: { login: "alice" } },
        ];

        render(
            <ReactionBar
                reactions={reactions}
                counts={{ "+1": 5, heart: 3 }}
                onReact={vi.fn()}
            />,
        );

        // The heart button is still rendered (count > 0) but has no tooltip.
        expect(screen.getByLabelText(/❤️/)).toBeInTheDocument();
        const tooltips = screen.getAllByTestId("tooltip-content");
        expect(tooltips).toHaveLength(1);
        expect(tooltips[0]).toHaveTextContent("alice");
    });

    it("does not render a tooltip for reactions without a named user", () => {
        render(
            <ReactionBar
                reactions={[
                    { content: "+1", id: "1", user: null },
                    { content: "+1", id: "2", user: { login: "bob" } },
                ]}
                onReact={vi.fn()}
            />,
        );

        const tooltips = screen.getAllByTestId("tooltip-content");
        expect(tooltips).toHaveLength(1);
        expect(tooltips[0]).toHaveTextContent("bob");
    });
});
