// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeComment } from "~/__tests__/helpers/comment-fixtures";
import {
    mockCommentCard,
    mockMarkdownEditor,
    mockMarkdownRenderer,
    mockPopover,
    mockReactionBar,
    mockReactionPicker,
    mockUseReactionToggle,
    mockUseReviewThreadOperations,
} from "~/__tests__/helpers/component-mocks";
import {
    reviewCommentReactionsUtils,
    reviewCommentsListUtils,
    reviewThreadsApi,
} from "~/__tests__/helpers/trpc-mocks";

import { InlineCommentThread } from "~/components/inline-comment-thread";

const mockThreadsQuery = vi.hoisted(() =>
    vi.fn<() => { data: unknown; isPending?: boolean }>(() => ({
        data: undefined,
    })),
);
vi.mock("~/trpc/react", () => ({
    api: {
        useUtils: vi.fn(() => ({
            reviewComments: { list: reviewCommentsListUtils() },
            reviews: {
                getPending: {
                    cancel: vi.fn(),
                    invalidate: vi.fn(),
                    getData: vi.fn(() => []),
                    setData: vi.fn(),
                },
            },
            reactions: {
                getForReviewComments: reviewCommentReactionsUtils(),
            },
        })),
        ...reviewThreadsApi(mockThreadsQuery),
    },
}));

vi.mock("~/hooks/use-reaction-toggle", () => mockUseReactionToggle());

vi.mock("~/hooks/use-review-thread-operations", () =>
    mockUseReviewThreadOperations(),
);

vi.mock("~/components/comment-card", () => mockCommentCard());

vi.mock("~/components/resolved-thread-banner", () => ({
    ResolvedThreadBanner: ({
        onShow,
        resolver,
    }: {
        onShow: () => void;
        resolver: string;
    }) => (
        <div data-testid="resolved-banner" data-resolver={resolver}>
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
    CollapseButton: ({ onClick }: { onClick: () => void }) => (
        <button data-testid="collapse-button" onClick={onClick} type="button">
            Collapse
        </button>
    ),
}));

vi.mock("~/components/reaction-bar", () => mockReactionBar());

vi.mock("~/components/reaction-picker", () => mockReactionPicker());

vi.mock("~/components/markdown/markdown-renderer", () =>
    mockMarkdownRenderer(),
);

vi.mock("~/components/markdown/markdown-editor", () =>
    mockMarkdownEditor({
        textareaTestId: "reply-textarea",
        cancelTestId: "cancel-reply",
    }),
);

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

vi.mock("~/components/ui/popover", () => mockPopover());

// ---- Helpers ----
const defaultProps = {
    parentComment: makeComment(),
    replies: [],
    owner: "test-owner",
    repo: "test-repo",
    number: 42,
    permissionContext: {
        currentUser: "testuser",
        isPullRequestAuthor: false,
        repoPermission: "write" as const,
        isPullRequestLocked: false,
    },
};

// ---- Tests ----
function mockResolvedThread() {
    mockThreadsQuery.mockReturnValue({
        data: [
            {
                id: "thread-1",
                isResolved: true,
                isOutdated: false,
                resolvedBy: "resolver-user",
                comments: [{ id: 1 }],
            },
        ],
    });
}

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
        expect(screen.getByTestId("comment-card")).toHaveAttribute(
            "data-user-href",
            "https://github.com/author",
        );
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
        mockResolvedThread();

        render(<InlineCommentThread {...defaultProps} />);

        expect(screen.getByTestId("resolved-banner")).toBeInTheDocument();
        expect(screen.getByTestId("resolved-banner")).toHaveAttribute(
            "data-resolver",
            "resolver-user",
        );
        expect(screen.queryByTestId("comment-card")).not.toBeInTheDocument();
    });

    it("shows full thread after clicking show on resolved banner", async () => {
        const user = userEvent.setup();
        mockResolvedThread();

        render(<InlineCommentThread {...defaultProps} />);
        expect(screen.getByTestId("resolved-banner")).toBeInTheDocument();
        expect(screen.queryByTestId("comment-card")).not.toBeInTheDocument();

        await user.click(screen.getByTestId("show-thread-btn"));

        // After expanding, comment card appears
        const card = screen.getByTestId("comment-card");
        expect(card).toBeInTheDocument();
        // Resolved threads offer a collapse control in the parent card header.
        expect(card.querySelector('[data-testid="collapse-button"]')).not.toBe(
            null,
        );
    });

    it("collapses the expanded resolved thread back to the banner", async () => {
        const user = userEvent.setup();
        mockResolvedThread();

        render(<InlineCommentThread {...defaultProps} />);
        await user.click(screen.getByTestId("show-thread-btn"));
        expect(screen.getByTestId("comment-card")).toBeInTheDocument();

        await user.click(screen.getByTestId("collapse-button"));

        expect(screen.getByTestId("resolved-banner")).toBeInTheDocument();
        expect(screen.queryByTestId("comment-card")).not.toBeInTheDocument();
    });

    it("does not offer collapse for unresolved threads", () => {
        render(<InlineCommentThread {...defaultProps} />);

        expect(screen.queryByTestId("collapse-button")).not.toBeInTheDocument();
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
        render(
            <InlineCommentThread
                {...defaultProps}
                permissionContext={{
                    ...defaultProps.permissionContext,
                    repoPermission: null,
                    isPullRequestLocked: true,
                }}
            />,
        );
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
        for (const card of commentCards) {
            expect(card).toHaveAttribute(
                "data-user-href",
                "https://github.com/author",
            );
        }
        const bodies = screen.getAllByTestId("comment-body");
        expect(bodies[0]).toHaveTextContent("Test comment body");
        expect(bodies[1]).toHaveTextContent("A reply to the parent comment");
    });
});
