// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GQLClosedEvent } from "~/server/github-graphql";
import { StateEventContent } from "./state-event";

vi.mock("~/components/hovercards/user-hover-card", () => ({
    UserHoverCard: ({ children }: { children: React.ReactNode }) => children,
}));

const ACTOR = {
    __typename: "User",
    login: "octocat",
    avatarUrl: "https://avatars/octocat",
    url: "https://github.com/octocat",
} as const;

function closedEvent(
    id: string,
    stateReason: GQLClosedEvent["stateReason"],
): GQLClosedEvent {
    return {
        __typename: "ClosedEvent",
        id,
        actor: ACTOR,
        createdAt: "2026-09-18T15:08:52Z",
        stateReason,
    };
}

describe("StateEventContent", () => {
    it("uses GitHub's wording for every issue closure reason", () => {
        render(
            <>
                <StateEventContent
                    event={closedEvent("completed", "COMPLETED")}
                    provider="gh"
                />
                <StateEventContent
                    event={closedEvent("not-planned", "NOT_PLANNED")}
                    provider="gh"
                />
                <StateEventContent
                    event={closedEvent("duplicate", "DUPLICATE")}
                    provider="gh"
                />
            </>,
        );

        expect(
            screen.getByText(/closed this as completed/),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/closed this as not planned/),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/closed this as duplicate/),
        ).toBeInTheDocument();
    });

    it("keeps provider events without a reason generic", () => {
        render(
            <StateEventContent
                event={closedEvent("generic", null)}
                provider="cb"
            />,
        );

        expect(screen.getByText(/closed this/)).toBeInTheDocument();
        expect(screen.queryByText(/closed this as/)).not.toBeInTheDocument();
    });
});
