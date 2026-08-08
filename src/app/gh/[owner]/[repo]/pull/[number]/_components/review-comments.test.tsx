// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReviewComment } from "~/server/github";

import { ReviewComments } from "./review-comments";

const mockThreadsQuery = vi.hoisted(() =>
    vi.fn<() => { data: unknown; isPending?: boolean }>(() => ({
        data: undefined,
    })),
);
vi.mock("~/trpc/react", () => ({
    api: {
        useUtils: vi.fn(() => ({
            reviewComments: {
                list: {
                    cancel: vi.fn(),
                    invalidate: vi.fn(),
                    getData: vi.fn(() => []),
                    setData: vi.fn(),
                },
            },
            reviews: {
                getPending: {
                    getData: vi.fn(() => ({ comments: [] })),
                },
            },
            reactions: {
                getForReviewComments: {
                    cancel: vi.fn(),
                    invalidate: vi.fn(),
                    getData: vi.fn(() => ({})),
                    setData: vi.fn(),
                },
            },
            timeline: {
                list: {
                    cancel: vi.fn(),
                    getInfiniteData: vi.fn(() => undefined),
                    setInfiniteData: vi.fn(),
                    invalidate: vi.fn(),
                },
            },
        })),
        users: {
            currentUser: {
                useQuery: vi.fn(() => ({
                    data: {
                        login: "testuser",
                        avatarUrl: "https://example.com/avatar.png",
                    },
                })),
            },
        },
        reactions: {
            getForReviewComments: {
                useQuery: vi.fn(() => ({ data: {} })),
            },
        },
        reviewComments: {
            threads: { useQuery: mockThreadsQuery },
            reply: {
                useMutation: vi.fn(() => ({
                    mutate: vi.fn(),
                    isPending: false,
                    isError: false,
                })),
            },
            update: {
                useMutation: vi.fn(() => ({
                    mutate: vi.fn(),
                    isPending: false,
                    isError: false,
                })),
            },
            delete: {
                useMutation: vi.fn(() => ({
                    mutate: vi.fn(),
                    isPending: false,
                    isError: false,
                })),
            },
        },
    },
}));

vi.mock("~/hooks/use-reaction-toggle", () => ({
    useTogglePullRequestReviewCommentReaction: vi.fn(() => ({
        mutate: vi.fn(),
        isPending: false,
    })),
}));

vi.mock("~/hooks/use-review-thread-operations", () => ({
    useReviewThreadOperations: vi.fn(() => ({
        operations: [],
        isPending: () => false,
        resolve: vi.fn(),
    })),
    applyReviewThreadOperations: vi.fn((threads: unknown) => threads),
}));

vi.mock("~/components/comment-card", () => ({
    CommentCard: ({
        children,
        headerActions,
        footer,
        userHref,
    }: {
        children?: React.ReactNode;
        headerActions?: React.ReactNode;
        footer?: React.ReactNode;
        userHref?: string;
    }) => (
        <div data-testid="comment-card" data-user-href={userHref}>
            {headerActions}
            <div data-testid="comment-body">{children}</div>
            {footer}
        </div>
    ),
}));

vi.mock("~/components/markdown/markdown-renderer", () => ({
    MarkdownRenderer: ({ content }: { content: string }) => (
        <div data-testid="markdown-renderer">{content}</div>
    ),
}));

vi.mock("~/components/reaction-bar", () => ({
    ReactionBar: () => <div data-testid="reaction-bar" />,
}));

vi.mock("~/components/reaction-picker", () => ({
    ReactionPicker: () => <div data-testid="reaction-picker" />,
}));

vi.mock("~/components/diff-view", () => ({
    DiffView: () => <div data-testid="diff-view" />,
}));

vi.mock("~/components/inline-comment-thread", () => ({
    ReplyTextboxButton: () => <button type="button">Reply...</button>,
}));

vi.mock("~/components/resolved-thread-banner", () => ({
    ResolveButton: () => <button type="button">Resolve</button>,
}));

vi.mock("~/components/ui/dialog", () => ({
    Dialog: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
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

vi.mock("~/components/ui/popover", () => ({
    Popover: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
    ),
    PopoverContent: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
    ),
    PopoverTrigger: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
    ),
}));

// ---- Helpers ----
function makeComment(overrides: Record<string, unknown> = {}): ReviewComment {
    return {
        id: 1,
        body: "Test comment body",
        user: {
            login: "author-user",
            avatar_url: "https://example.com/avatar.png",
            id: 42,
            node_id: "MDQ6VXNlcjQy",
            gravatar_id: "",
            url: "https://api.github.com/users/author",
            received_events_url: "",
            type: "User" as const,
            site_admin: false,
            html_url: "https://github.com/author",
        },
        created_at: "2026-05-15T19:00:03Z",
        author_association: "NONE",
        path: "text/3959-llm-policy.md",
        line: null,
        start_line: null,
        pull_request_review_id: 4300660810,
        url: "",
        node_id: "",
        diff_hunk: "",
        commit_id: "",
        original_commit_id: "",
        html_url: "",
        pull_request_url: "",
        _links: {
            self: { href: "" },
            html: { href: "" },
            pull_request: { href: "" },
        },
        reactions: {
            url: "",
            total_count: 0,
            "+1": 0,
            "-1": 0,
            laugh: 0,
            hooray: 0,
            confused: 0,
            heart: 0,
            rocket: 0,
            eyes: 0,
        },
        body_html: "",
        body_text: "",
        ...overrides,
    } as unknown as ReviewComment;
}

const REVIEW_ID = 4300660810;
const PATH = "text/3959-llm-policy.md";

const unresolvedComment = makeComment({
    id: 3250370013,
    body: "So I understand that my voice does not have very much weight here.",
});
const outdatedResolvedComment = makeComment({
    id: 3250493529,
    body: "A suggestion on the summary wording.",
});
const resolvedComment = makeComment({
    id: 3250765189,
    body: "A large fraction of the ethical issues with LLM use apply equally.",
});

const defaultProps = {
    owner: "rust-lang",
    repo: "rfcs",
    number: 3959,
    reviewId: REVIEW_ID,
    hasReviewBody: false,
    state: "commented",
    allComments: [unresolvedComment, outdatedResolvedComment, resolvedComment],
    currentUserLogin: "testuser",
    canInteract: false,
};

function makeThread(
    id: string,
    isResolved: boolean,
    isOutdated: boolean,
    commentIds: number[],
) {
    return {
        id,
        isResolved,
        isOutdated,
        path: PATH,
        pullRequestId: "PR_kwDOAQt0tc5",
        comments: commentIds.map((commentId) => ({
            id: commentId,
            body: "body",
            author: { login: "author", avatarUrl: "", url: "" },
            createdAt: "2026-05-15T19:00:03Z",
            replyToId: null,
        })),
    };
}

describe("ReviewComments", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Threads query settled: each top-level comment belongs to its own
        // thread on the same file, mirroring the olivia-fl review on
        // rust-lang/rfcs#3959.
        mockThreadsQuery.mockReturnValue({
            data: [
                makeThread("thread-unresolved", false, false, [
                    unresolvedComment.id,
                ]),
                makeThread("thread-outdated", true, true, [
                    outdatedResolvedComment.id,
                ]),
                makeThread("thread-resolved", true, false, [
                    resolvedComment.id,
                ]),
            ],
        });
    });

    it("renders one block per thread with per-thread resolved state", () => {
        render(<ReviewComments {...defaultProps} />);

        const blocks = screen.getAllByTestId("review-thread-block");
        expect(blocks).toHaveLength(3);

        // Unresolved thread: full body, no Resolved label, no Show thread.
        const unresolvedBlock = blocks[0]!;
        expect(
            within(unresolvedBlock).getByTestId("comment-card"),
        ).toHaveAttribute("data-user-href", "https://github.com/author");
        expect(
            within(unresolvedBlock).getByTestId("markdown-renderer"),
        ).toHaveTextContent("So I understand that my voice does not have");
        expect(
            within(unresolvedBlock).queryByText("Resolved"),
        ).not.toBeInTheDocument();
        expect(
            within(unresolvedBlock).queryByRole("button", {
                name: /Show thread/,
            }),
        ).not.toBeInTheDocument();

        // Outdated resolved thread: Resolved + Outdated + Show thread,
        // body collapsed.
        const outdatedBlock = blocks[1]!;
        expect(within(outdatedBlock).getByText("Resolved")).toBeInTheDocument();
        expect(within(outdatedBlock).getByText("Outdated")).toBeInTheDocument();
        expect(
            within(outdatedBlock).getByRole("button", {
                name: /Show thread/,
            }),
        ).toBeInTheDocument();
        expect(
            within(outdatedBlock).queryByTestId("markdown-renderer"),
        ).not.toBeInTheDocument();

        // Resolved thread: Resolved + Show thread, body collapsed.
        const resolvedBlock = blocks[2]!;
        expect(within(resolvedBlock).getByText("Resolved")).toBeInTheDocument();
        expect(
            within(resolvedBlock).queryByText("Outdated"),
        ).not.toBeInTheDocument();
        expect(
            within(resolvedBlock).getByRole("button", {
                name: /Show thread/,
            }),
        ).toBeInTheDocument();
        expect(
            within(resolvedBlock).queryByTestId("markdown-renderer"),
        ).not.toBeInTheDocument();

        // One Show thread button per resolved thread, never one per file.
        expect(
            screen.getAllByRole("button", { name: /Show thread/ }),
        ).toHaveLength(2);
    });

    it("expands a resolved thread when Show thread is clicked", async () => {
        const user = userEvent.setup();
        render(<ReviewComments {...defaultProps} />);

        const resolvedBlock = screen.getAllByTestId("review-thread-block")[2]!;
        expect(
            within(resolvedBlock).queryByTestId("markdown-renderer"),
        ).not.toBeInTheDocument();

        await user.click(
            within(resolvedBlock).getByRole("button", {
                name: /Show thread/,
            }),
        );

        expect(
            within(resolvedBlock).getByTestId("markdown-renderer"),
        ).toHaveTextContent(
            "A large fraction of the ethical issues with LLM use apply equally.",
        );
    });

    it("renders nothing while thread resolution state is loading", () => {
        mockThreadsQuery.mockReturnValue({ data: undefined, isPending: true });

        render(<ReviewComments {...defaultProps} />);

        expect(
            screen.queryByTestId("review-thread-block"),
        ).not.toBeInTheDocument();
    });
});
