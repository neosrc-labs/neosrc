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
});
