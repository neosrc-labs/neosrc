// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockQuery = vi.hoisted(() => vi.fn());

vi.mock("~/trpc/react", () => ({
    api: {
        pulls: {
            recentlyPushedBranch: { useQuery: mockQuery },
        },
    },
}));

import { RecentlyPushedBanner } from "./recently-pushed-banner";

function renderBanner() {
    return render(
        <RecentlyPushedBanner owner="acme" repo="app" provider="gh" />,
    );
}

describe("RecentlyPushedBanner", () => {
    it("renders nothing while the query has not resolved", () => {
        mockQuery.mockReturnValue({ data: undefined });
        const { container } = renderBanner();
        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing when no branch qualifies", () => {
        mockQuery.mockReturnValue({ data: null });
        const { container } = renderBanner();
        expect(container).toBeEmptyDOMElement();
    });

    it("shows the branch and links to the provider compare page", () => {
        mockQuery.mockReturnValue({
            data: {
                branch: "feat/login",
                pushedAt: new Date(Date.now() - 120_000).toISOString(),
                compareUrl:
                    "https://github.com/acme/app/compare/main...feat/login?expand=1",
            },
        });
        renderBanner();

        expect(
            screen.getByRole("link", { name: "feat/login" }),
        ).toHaveAttribute("href", "/gh/acme/app/commits/feat%2Flogin");
        expect(
            screen.getByText(/had recent pushes 2 mins ago/),
        ).toBeInTheDocument();
        const link = screen.getByRole("link", {
            name: /compare & pull request/i,
        });
        expect(link).toHaveAttribute(
            "href",
            "https://github.com/acme/app/compare/main...feat/login?expand=1",
        );
        expect(link).toHaveAttribute("target", "_blank");
    });
});
