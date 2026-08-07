// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InlineCommentThread } from "~/components/inline-comment-thread";
import type { ReviewComment } from "~/server/github";

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
                    cancel: vi.fn(),
                    invalidate: vi.fn(),
                    getData: vi.fn(() => []),
                    setData: vi.fn(),
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
            threads: { useQuery: mockThreadsQuery },
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

vi.mock("~/components/resolved-thread-banner", () => ({
    ResolvedThreadBanner: ({ onShow }: { onShow: () => void }) => (
        <div data-testid="resolved-banner">
            <button
                onClick={onShow}
                data-testid="show-thread-btn"
                type="button"
            >
                Show thread
            </button>
        </div>
    ),
    ResolveButton: ({
        onClick,
        isPending,
        isUnresolve,
    }: {
        onClick: () => void;
        isPending: boolean;
        isUnresolve: boolean;
    }) => (
        <button
            data-testid="resolve-button"
            data-pending={String(isPending)}
            data-unresolve={String(isUnresolve)}
            onClick={onClick}
            type="button"
        >
            {isUnresolve ? "Unresolve" : "Resolve"}
        </button>
    ),
}));

vi.mock("~/components/reaction-bar", () => ({
    ReactionBar: () => <div data-testid="reaction-bar" />,
}));

vi.mock("~/components/reaction-picker", () => ({
    ReactionPicker: () => <div data-testid="reaction-picker" />,
}));

vi.mock("~/components/markdown/markdown-renderer", () => ({
    MarkdownRenderer: ({ content }: { content: string }) => (
        <div data-testid="markdown-renderer">{content}</div>
    ),
}));

vi.mock("~/components/markdown/markdown-editor", () => ({
    MarkdownEditor: (props: {
        value?: string;
        onChange?: (v: string) => void;
        onCancel?: () => void;
        footerActions?: Array<{
            label: string;
            onClick: () => void;
            disabled?: (text: string) => boolean;
        }>;
    }) => (
        <div data-testid="markdown-editor">
            <textarea
                data-testid="reply-textarea"
                onChange={(e) => props.onChange?.(e.target.value)}
                value={props.value ?? ""}
            />
            <button
                data-testid="cancel-reply"
                onClick={() => props.onCancel?.()}
                type="button"
            >
                Cancel
            </button>
            {(props.footerActions ?? []).map((action) => (
                <button
                    key={action.label}
                    data-testid={`action-${action.label}`}
                    onClick={() => action.onClick?.()}
                    type="button"
                    disabled={action.disabled?.(props.value ?? "") ?? false}
                >
                    {action.label}
                </button>
            ))}
        </div>
    ),
}));

vi.mock("lucide-react", () => ({
    MoreVertical: () => <div data-testid="more-vertical" />,
    SquarePen: () => <div data-testid="square-pen" />,
    Trash2: () => <div data-testid="trash-2" />,
    ChevronDown: () => <div data-testid="chevron-down" />,
}));

vi.mock("~/components/ui/button", () => ({
    Button: ({
        children,
        onClick,
        variant,
    }: {
        children?: React.ReactNode;
        onClick?: () => void;
        variant?: string;
    }) => (
        <button
            data-testid={`button-${variant}`}
            onClick={onClick}
            type="button"
        >
            {children}
        </button>
    ),
}));

vi.mock("~/components/ui/dialog", () => ({
    Dialog: ({ children }: { children?: React.ReactNode }) => (
        <div data-testid="dialog">{children}</div>
    ),
    DialogContent: ({ children }: { children?: React.ReactNode }) => (
        <div data-testid="dialog-content">{children}</div>
    ),
    DialogDescription: ({ children }: { children?: React.ReactNode }) => (
        <div data-testid="dialog-description">{children}</div>
    ),
    DialogFooter: ({ children }: { children?: React.ReactNode }) => (
        <div data-testid="dialog-footer">{children}</div>
    ),
    DialogHeader: ({ children }: { children?: React.ReactNode }) => (
        <div data-testid="dialog-header">{children}</div>
    ),
    DialogTitle: ({ children }: { children?: React.ReactNode }) => (
        <div data-testid="dialog-title">{children}</div>
    ),
}));

vi.mock("~/components/ui/popover", () => ({
    Popover: ({ children }: { children?: React.ReactNode }) => (
        <div data-testid="popover">{children}</div>
    ),
    PopoverContent: ({ children }: { children?: React.ReactNode }) => (
        <div data-testid="popover-content">{children}</div>
    ),
    PopoverTrigger: ({ children }: { children?: React.ReactNode }) => (
        <div data-testid="popover-trigger">{children}</div>
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
        created_at: "2024-06-15T10:30:00Z",
        author_association: "MEMBER",
        path: "src/file.ts",
        line: 42,
        start_line: null,
        pull_request_review_id: null,
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

const defaultProps = {
    parentComment: makeComment(),
    replies: [],
    owner: "test-owner",
    repo: "test-repo",
    number: 42,
};

// ---- Tests ----
describe("InlineCommentThread", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Threads query settled: the parent comment belongs to an unresolved
        // thread, so the full thread renders.
        mockThreadsQuery.mockReturnValue({
            data: [
                {
                    id: "thread-1",
                    isResolved: false,
                    isOutdated: false,
                    comments: [{ id: 1 }],
                },
            ],
        });
    });

    it("does not render the comment body while thread resolution is loading", () => {
        mockThreadsQuery.mockReturnValue({ data: undefined, isPending: true });

        render(<InlineCommentThread {...defaultProps} />);

        expect(screen.queryByTestId("comment-card")).not.toBeInTheDocument();
        expect(screen.queryByTestId("resolved-banner")).not.toBeInTheDocument();
        expect(screen.queryByText("Reply...")).not.toBeInTheDocument();
    });

    it("renders thread with parent comment", () => {
        render(<InlineCommentThread {...defaultProps} />);

        expect(screen.getByTestId("comment-card")).toBeInTheDocument();
        expect(screen.getByTestId("comment-body")).toHaveTextContent(
            "Test comment body",
        );
        expect(screen.getByTestId("markdown-renderer")).toHaveTextContent(
            "Test comment body",
        );
        expect(screen.getByTestId("reaction-bar")).toBeInTheDocument();
        expect(screen.getByTestId("reaction-picker")).toBeInTheDocument();
        expect(screen.getByText("Reply...")).toBeInTheDocument();
        expect(screen.getByTestId("resolve-button")).toBeInTheDocument();
    });

    it("shows resolved thread banner when thread is resolved", () => {
        mockThreadsQuery.mockReturnValue({
            data: [
                {
                    id: "thread-1",
                    isResolved: true,
                    isOutdated: false,
                    comments: [{ id: 1 }],
                },
            ],
        });

        render(<InlineCommentThread {...defaultProps} />);

        expect(screen.getByTestId("resolved-banner")).toBeInTheDocument();
        expect(screen.queryByTestId("comment-card")).not.toBeInTheDocument();
    });

    it("shows full thread after clicking show on resolved banner", async () => {
        const user = userEvent.setup();
        mockThreadsQuery.mockReturnValue({
            data: [
                {
                    id: "thread-1",
                    isResolved: true,
                    isOutdated: false,
                    comments: [{ id: 1 }],
                },
            ],
        });

        render(<InlineCommentThread {...defaultProps} />);
        expect(screen.getByTestId("resolved-banner")).toBeInTheDocument();
        expect(screen.queryByTestId("comment-card")).not.toBeInTheDocument();

        await user.click(screen.getByTestId("show-thread-btn"));

        // After expanding, comment card appears
        expect(screen.getByTestId("comment-card")).toBeInTheDocument();
    });

    it("opens and closes reply form", async () => {
        const user = userEvent.setup();
        render(<InlineCommentThread {...defaultProps} />);

        // Initially no reply form
        expect(screen.queryByTestId("markdown-editor")).not.toBeInTheDocument();

        // Click "Reply..." to open reply form
        await user.click(screen.getByText("Reply..."));
        expect(screen.getByTestId("markdown-editor")).toBeInTheDocument();

        // Click Cancel to close
        await user.click(screen.getByTestId("cancel-reply"));
        expect(screen.queryByTestId("markdown-editor")).not.toBeInTheDocument();
    });

    it("does not render reply controls when canInteract is false", () => {
        render(<InlineCommentThread {...defaultProps} canInteract={false} />);

        expect(screen.queryByText("Reply...")).not.toBeInTheDocument();
        expect(screen.queryByTestId("resolve-button")).not.toBeInTheDocument();
    });

    it("renders replies when provided", () => {
        const reply = makeComment({
            id: 2,
            body: "A reply to the parent comment",
        });

        render(<InlineCommentThread {...defaultProps} replies={[reply]} />);

        const commentCards = screen.getAllByTestId("comment-card");
        expect(commentCards).toHaveLength(2);
        const bodies = screen.getAllByTestId("comment-body");
        expect(bodies[0]).toHaveTextContent("Test comment body");
        expect(bodies[1]).toHaveTextContent("A reply to the parent comment");
    });
});
