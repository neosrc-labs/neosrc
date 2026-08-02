// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { GQLPullRequestReview } from "~/server/github-graphql";
import { PullRequestReviewContent } from "./pull-request-review";

const mockByReviewIdQuery = vi.hoisted(() =>
    vi.fn(() => ({ data: [] as unknown[] })),
);
const mockMutation = vi.hoisted(() =>
    vi.fn(() => ({
        mutate: vi.fn(),
        isPending: false,
        isError: false,
    })),
);
const { minimizeMutate, unminimizeMutate } = vi.hoisted(() => ({
    minimizeMutate: vi.fn(),
    unminimizeMutate: vi.fn(),
}));
const mockMinimize = vi.hoisted(() =>
    vi.fn(() => ({
        mutate: minimizeMutate,
        isPending: false,
        isError: false,
    })),
);
const mockUnminimize = vi.hoisted(() =>
    vi.fn(() => ({
        mutate: unminimizeMutate,
        isPending: false,
        isError: false,
    })),
);

vi.mock("~/trpc/react", () => ({
    api: {
        useUtils: vi.fn(() => ({
            timeline: {
                list: {
                    cancel: vi.fn(),
                    getInfiniteData: vi.fn(() => undefined),
                    setInfiniteData: vi.fn(),
                    invalidate: vi.fn(),
                },
            },
        })),
        pulls: {
            updateComment: { useMutation: mockMutation },
            updateReview: { useMutation: mockMutation },
            deleteComment: { useMutation: mockMutation },
        },
        reactions: {
            toggleIssueComment: { useMutation: mockMutation },
            togglePullRequestReview: { useMutation: mockMutation },
        },
        reviewComments: {
            byReviewId: { useQuery: mockByReviewIdQuery },
        },
        reviews: {
            minimize: { useMutation: mockMinimize },
            unminimize: { useMutation: mockUnminimize },
        },
    },
}));

vi.mock("next/link", () => ({
    default: ({
        children,
        ...props
    }: React.ComponentProps<"a"> & { children?: React.ReactNode }) => (
        <a {...props}>{children}</a>
    ),
}));

vi.mock("~/components/CommentCard", () => ({
    CommentCard: ({
        children,
        headerActions,
        footer,
    }: {
        children?: React.ReactNode;
        headerActions?: React.ReactNode;
        footer?: React.ReactNode;
    }) => (
        <div data-testid="comment-card">
            {headerActions}
            <div data-testid="comment-body">{children}</div>
            {footer}
        </div>
    ),
}));

vi.mock("~/components/markdown/MarkdownRenderer", () => ({
    MarkdownRenderer: ({ content }: { content: string }) => (
        <div data-testid="markdown">{content}</div>
    ),
}));

vi.mock("~/components/ReactionBar", () => ({
    ReactionBar: () => <div data-testid="reaction-bar" />,
}));

vi.mock("~/components/ReactionPicker", () => ({
    ReactionPicker: () => <div data-testid="reaction-picker" />,
}));

vi.mock("~/components/ui/popover", () => ({
    Popover: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
    ),
    PopoverContent: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
    ),
    PopoverTrigger: ({ children }: { children?: React.ReactNode }) => (
        <>{children}</>
    ),
}));

vi.mock("~/components/ui/dialog", () => ({
    Dialog: ({ children }: { children?: React.ReactNode }) => (
        <div data-testid="dialog">{children}</div>
    ),
    DialogContent: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
    ),
    DialogDescription: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
    ),
    DialogFooter: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
    ),
    DialogHeader: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
    ),
    DialogTitle: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
    ),
}));

vi.mock("~/components/user-link", () => ({
    UserLink: ({ actor }: { actor: { login: string } | null }) => (
        <span data-testid="user-link">{actor?.login ?? "unknown"}</span>
    ),
}));

vi.mock("~/components/hovercards/user-hover-card", () => ({
    UserHoverCard: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
    ),
}));

vi.mock(
    "~/app/gh/[owner]/[repo]/pull/[number]/_components/review-comments",
    () => ({
        ReviewComments: () => <div data-testid="review-comments" />,
    }),
);

function makeReview(
    overrides: Partial<GQLPullRequestReview> = {},
): GQLPullRequestReview {
    return {
        __typename: "PullRequestReview",
        id: "PRR_kwDOQMFd_c8AAAABIFkLNg",
        databaseId: 4837673782,
        state: "COMMENTED",
        body: "foo bar",
        author: {
            __typename: "User",
            login: "ranger-ross",
            avatarUrl: "https://example.com/avatar.png",
            url: "https://github.com/ranger-ross",
        },
        authorAssociation: "OWNER",
        submittedAt: "2026-08-02T07:45:06Z",
        createdAt: "2026-08-02T07:45:06Z",
        isMinimized: true,
        minimizedReason: "outdated",
        reactions: { nodes: [] },
        ...overrides,
    };
}

const baseProps = {
    owner: "ranger-ross",
    repo: "jj-fun-times",
    number: 29,
    currentUserLogin: "testuser",
    canInteract: true,
    allComments: [],
    commentReactions: {},
    editingCommentId: null,
    editBody: "",
    savedBodies: {},
    onEditBodyChange: vi.fn(),
    onStartEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onSaveEdit: vi.fn(),
    onReactToReview: vi.fn(),
    expandedMinimized: {},
    onToggleMinimized: vi.fn(),
};

function ToggleHarness({ event }: { event: GQLPullRequestReview }) {
    const [expanded, setExpanded] = useState<Record<number, boolean>>({});
    return (
        <PullRequestReviewContent
            {...baseProps}
            event={event}
            expandedMinimized={expanded}
            onToggleMinimized={(id, isExpanded) =>
                setExpanded((prev) => ({ ...prev, [id]: isExpanded }))
            }
        />
    );
}

describe("PullRequestReviewContent minimized reviews", () => {
    it("renders a minimized review collapsed", () => {
        render(
            <PullRequestReviewContent {...baseProps} event={makeReview()} />,
        );

        expect(screen.getByText(/A review by/)).toBeInTheDocument();
        expect(screen.getByText("ranger-ross")).toBeInTheDocument();
        expect(screen.getByText("Outdated")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Show review" }),
        ).toBeInTheDocument();
        expect(screen.queryByTestId("comment-card")).not.toBeInTheDocument();
        expect(screen.queryByTestId("review-comments")).not.toBeInTheDocument();
        expect(screen.queryByText("foo bar")).not.toBeInTheDocument();
    });

    it("falls back to lowercase outdated when minimizedReason is missing", () => {
        render(
            <PullRequestReviewContent
                {...baseProps}
                event={makeReview({ minimizedReason: null })}
            />,
        );

        expect(screen.getByText(/A review by/)).toBeInTheDocument();
        expect(screen.getByText("outdated")).toBeInTheDocument();
    });

    it("expands a minimized review via Show review", async () => {
        const user = userEvent.setup();
        render(<ToggleHarness event={makeReview()} />);

        await user.click(screen.getByRole("button", { name: "Show review" }));

        expect(screen.getByTestId("comment-card")).toBeInTheDocument();
        expect(screen.getByText("foo bar")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Unhide" }),
        ).toBeInTheDocument();
        expect(screen.getByTestId("review-comments")).toBeInTheDocument();
    });

    it("renders a non-minimized review in full with a Hide review menu option", () => {
        render(
            <PullRequestReviewContent
                {...baseProps}
                event={makeReview({ isMinimized: false })}
            />,
        );

        expect(screen.getByText(/reviewed/)).toBeInTheDocument();
        expect(screen.getByTestId("comment-card")).toBeInTheDocument();
        expect(screen.getByText("foo bar")).toBeInTheDocument();
        expect(screen.getByTestId("review-comments")).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Show review" }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Unhide" }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Hide" }),
        ).toBeInTheDocument();
    });

    it("hides a review via the menu with the selected reason", async () => {
        const user = userEvent.setup();
        render(
            <PullRequestReviewContent
                {...baseProps}
                event={makeReview({ isMinimized: false })}
            />,
        );

        await user.click(screen.getByRole("button", { name: "Hide" }));

        expect(
            screen.getByText(
                /Select a reason for hiding this review by ranger-ross/,
            ),
        ).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Outdated" }));

        expect(minimizeMutate).toHaveBeenCalledWith({
            owner: "ranger-ross",
            repo: "jj-fun-times",
            number: 29,
            subjectId: "PRR_kwDOQMFd_c8AAAABIFkLNg",
            classifier: "OUTDATED",
        });
    });

    it("unhides a minimized review from the menu", async () => {
        const user = userEvent.setup();
        render(<ToggleHarness event={makeReview()} />);

        await user.click(screen.getByRole("button", { name: "Show review" }));
        await user.click(screen.getByRole("button", { name: "Unhide" }));

        expect(unminimizeMutate).toHaveBeenCalledWith({
            owner: "ranger-ross",
            repo: "jj-fun-times",
            number: 29,
            subjectId: "PRR_kwDOQMFd_c8AAAABIFkLNg",
        });
    });

    it("does not offer hide or unhide options without interaction permission", () => {
        render(
            <PullRequestReviewContent
                {...baseProps}
                canInteract={false}
                event={makeReview({ isMinimized: false })}
            />,
        );

        expect(
            screen.queryByRole("button", { name: "Hide" }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Unhide" }),
        ).not.toBeInTheDocument();
    });
});
