// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommentCard } from "./comment-card";

describe("CommentCard", () => {
    it("renders the comment body", () => {
        render(
            <CommentCard
                owner="owner"
                repo="repo"
                user={null}
                createdAt="2026-08-16T00:00:00Z"
            >
                <p>the comment body</p>
            </CommentCard>,
        );

        expect(screen.getByText("the comment body")).toBeInTheDocument();
    });

    it("caps the card at 800px so long comments stay readable", () => {
        const { container } = render(
            <CommentCard
                owner="owner"
                repo="repo"
                user={null}
                createdAt="2026-08-16T00:00:00Z"
            >
                <p>body</p>
            </CommentCard>,
        );

        const card = container.firstElementChild as HTMLElement;
        expect(card.className).toContain("max-w-[800px]");
    });
});
