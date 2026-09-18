// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GQLArchiveEvent } from "~/server/github-graphql";
import { ArchiveEventContent } from "./archive-event";

vi.mock("~/components/hovercards/user-hover-card", () => ({
    UserHoverCard: ({ children }: { children: React.ReactNode }) => children,
}));

const ACTOR = {
    __typename: "User",
    login: "ranger-ross",
    avatarUrl: "https://avatars/ranger-ross",
    url: "https://github.com/ranger-ross",
};

function renderEvent(event: GQLArchiveEvent) {
    render(<ArchiveEventContent event={event} provider="gh" />);
}

describe("ArchiveEventContent", () => {
    it("credits the admin who archived the pull request", () => {
        renderEvent({
            __typename: "ArchivedEvent",
            id: "ARE_1",
            actor: ACTOR,
            createdAt: "2026-09-18T15:08:52Z",
        });

        expect(screen.getByText(/A repository admin/)).toBeInTheDocument();
        expect(screen.getByText("ranger-ross")).toBeInTheDocument();
        expect(screen.getByText(/archived this/)).toBeInTheDocument();
    });

    it("reports an unarchive", () => {
        renderEvent({
            __typename: "UnarchivedEvent",
            id: "ARE_2",
            actor: ACTOR,
            createdAt: "2026-09-19T09:00:00Z",
        });

        expect(screen.getByText(/unarchived this/)).toBeInTheDocument();
    });

    it("omits the admin when GitHub reports none", () => {
        renderEvent({
            __typename: "ArchivedEvent",
            id: "ARE_3",
            actor: null,
            createdAt: "2026-09-18T15:08:52Z",
        });

        expect(screen.queryByText("ranger-ross")).not.toBeInTheDocument();
        expect(screen.getByText(/archived this/)).toBeInTheDocument();
    });
});
