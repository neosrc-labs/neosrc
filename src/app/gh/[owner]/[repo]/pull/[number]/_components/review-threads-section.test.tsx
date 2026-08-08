// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewThreadsSection } from "./review-threads-section";

vi.mock("@tanstack/react-virtual", () => ({
    useVirtualizer: ({ count }: { count: number }) => ({
        getTotalSize: () => count * 50,
        getVirtualItems: () =>
            Array.from({ length: count }, (_, i) => ({
                key: i,
                index: i,
                size: 50,
                start: i * 50,
            })),
    }),
}));

const mockThreadsPageQuery = vi.hoisted(() => vi.fn());
vi.mock("~/trpc/react", () => ({
    api: {
        reviewComments: {
            threadsPage: {
                useInfiniteQuery: mockThreadsPageQuery,
            },
        },
    },
}));

function makeThread(
    id: string,
    isResolved: boolean,
    isOutdated: boolean,
    body: string,
) {
    return {
        id,
        isResolved,
        isOutdated,
        path: "text/3959-llm-policy.md",
        commentCount: 1,
        root: {
            id: id === "t-suggestion" ? 1 : 2,
            body,
            author: {
                login: id === "t-suggestion" ? "ArhanChaudhary" : "someone",
                avatarUrl: "https://example.com/avatar.png",
            },
        },
    };
}

const defaultProps = {
    owner: "rust-lang",
    repo: "rfcs",
    number: 3959,
};

describe("ReviewThreadsSection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockThreadsPageQuery.mockReturnValue({
            data: {
                pages: [
                    {
                        threads: [
                            makeThread(
                                "t-suggestion",
                                true,
                                true,
                                "```suggestion\n* 2026 Mar 20: (Jack's post happens here)\n```",
                            ),
                            makeThread(
                                "t-regular",
                                true,
                                false,
                                "A regular resolved comment body",
                            ),
                        ],
                    },
                ],
            },
            hasNextPage: false,
            isFetchingNextPage: false,
            isLoading: false,
            fetchNextPage: vi.fn(),
        });
    });

    it("renders a resolved suggestion thread with line-through like other resolved threads", () => {
        render(<ReviewThreadsSection {...defaultProps} />);

        const buttons = screen.getAllByRole("button");
        expect(buttons).toHaveLength(2);
        for (const button of buttons) {
            expect(button.className).toContain("opacity-60");
        }

        // Suggestion label gets the same resolved styling as regular bodies.
        const suggestionLabel = screen.getByText(
            "Suggestion in text/3959-llm-policy.md",
        );
        expect(suggestionLabel.className).toContain("line-through");

        const regularBody = screen.getByText("A regular resolved comment body");
        expect(regularBody.className).toContain("line-through");

        // Suggestion and comment text share the same text color.
        expect(suggestionLabel.parentElement?.className).toContain(
            "text-text-label",
        );
        expect(regularBody.className).toContain("text-text-label");
    });

    it("does not strike through unresolved threads", () => {
        mockThreadsPageQuery.mockReturnValue({
            data: {
                pages: [
                    {
                        threads: [
                            makeThread(
                                "t-suggestion",
                                false,
                                false,
                                "```suggestion\n* 2026 Mar 20: (Jack's post happens here)\n```",
                            ),
                        ],
                    },
                ],
            },
            hasNextPage: false,
            isFetchingNextPage: false,
            isLoading: false,
            fetchNextPage: vi.fn(),
        });

        render(<ReviewThreadsSection {...defaultProps} />);

        const suggestionLabel = screen.getByText(
            "Suggestion in text/3959-llm-policy.md",
        );
        expect(suggestionLabel.className).not.toContain("line-through");
    });
});
