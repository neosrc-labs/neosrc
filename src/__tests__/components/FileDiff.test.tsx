// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTrpc = vi.hoisted(() => ({
    capturedOnSuccess: { current: null as ((data: unknown) => void) | null },
    createMutate: vi.fn(),
    startMutate: vi.fn(),
}));

vi.mock("~/trpc/react", () => ({
    api: {
        useUtils: vi.fn(() => ({
            reviewComments: { list: { invalidate: vi.fn() } },
            reviews: { getPending: { invalidate: vi.fn() } },
        })),
        reviewComments: {
            create: {
                useMutation: vi.fn(
                    (opts: { onSuccess?: (data: unknown) => void }) => {
                        mockTrpc.capturedOnSuccess.current =
                            opts?.onSuccess ?? null;
                        mockTrpc.createMutate.mockImplementation(
                            (_args: unknown) => {
                                mockTrpc.capturedOnSuccess.current?.({
                                    id: 99999,
                                });
                            },
                        );
                        return {
                            mutate: mockTrpc.createMutate,
                            isPending: false,
                            isError: false,
                        };
                    },
                ),
            },
        },
        reviews: {
            start: {
                useMutation: vi.fn(() => ({
                    mutate: mockTrpc.startMutate,
                    isPending: false,
                    isError: false,
                })),
            },
        },
    },
}));

vi.mock("~/components/DiffView", () => ({
    DiffView: (props: {
        showComments?: boolean;
        expandAllContext?: boolean;
        showCommentButton?: boolean;
        activeComment?: unknown;
        comments?: Array<{ id: number; body?: string }>;
    }) => (
        <div
            data-testid="diff-view"
            data-show-comments={String(props.showComments)}
            data-expand-all={String(props.expandAllContext)}
            data-show-comment-button={String(props.showCommentButton)}
        >
            {(props.comments ?? []).map((c) => (
                <div
                    key={c.id}
                    data-testid="diff-view-comment"
                    data-comment-id={c.id}
                >
                    {c.body}
                </div>
            ))}
        </div>
    ),
    groupThreads: vi.fn((comments: Array<{ id: number }>) =>
        comments.map((c) => ({ parent: c, replies: [] })),
    ),
}));

vi.mock("~/components/ImageDiff", () => ({
    default: () => <div data-testid="image-diff" />,
}));

vi.mock("~/components/SvgDiff", () => ({
    default: () => <div data-testid="svg-diff" />,
}));

vi.mock("~/components/InlineCommentThread", () => ({
    InlineCommentThread: (props: {
        parentComment: { id: number; body?: string };
    }) => (
        <div
            data-testid="inline-comment-thread"
            data-parent-id={props.parentComment?.id}
        >
            {props.parentComment?.body}
        </div>
    ),
}));

vi.mock("~/components/markdown/MarkdownEditor", () => ({
    MarkdownEditor: (props: {
        value?: string;
        onChange?: (v: string) => void;
        onCancel?: () => void;
        footerActions?: Array<{
            label: string;
            onClick: () => void;
        }>;
    }) => (
        <div data-testid="markdown-editor">
            <textarea
                data-testid="editor-textarea"
                onChange={(e) => props.onChange?.(e.target.value)}
                value={props.value ?? ""}
            />
            <button
                data-testid="editor-cancel"
                onClick={() => props.onCancel?.()}
                type="button"
            >
                Cancel
            </button>
            {(props.footerActions ?? []).map((action) => (
                <button
                    key={action.label}
                    data-testid={`action-${action.label}`}
                    onClick={() => action.onClick()}
                    type="button"
                >
                    {action.label}
                </button>
            ))}
        </div>
    ),
}));

vi.mock("lucide-react", () => ({
    UnfoldVertical: () => <div data-testid="unfold-icon" />,
    FoldVertical: () => <div data-testid="fold-icon" />,
    MessageSquare: () => <div data-testid="message-square" />,
    MessageSquareOff: () => <div data-testid="message-square-off" />,
}));

vi.mock("~/utils/viewed-files", () => ({
    getStoredSet: vi.fn(() => new Set<string>()),
    setStoredSet: vi.fn(),
    getViewedKey: vi.fn(() => "viewed-key"),
}));

import FileDiff from "~/components/FileDiff";

const BASE_FILE = {
    filename: "test.ts",
    patch: "mock patch content",
    status: "modified" as const,
    additions: 5,
    deletions: 2,
};

const BASE_PROPS = {
    file: BASE_FILE,
    owner: "test-owner",
    repo: "test-repo",
    number: "42",
    showComments: true,
};

function renderFileDiff(props?: Partial<Parameters<typeof FileDiff>[0]>) {
    return render(
        <FileDiff {...BASE_PROPS} {...props} file={props?.file ?? BASE_FILE} />,
    );
}

describe("FileDiff", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockTrpc.capturedOnSuccess.current = null;
        mockTrpc.createMutate.mockClear();
    });

    describe("file header", () => {
        it("renders filename in the header", () => {
            renderFileDiff();
            expect(
                screen.getByText((content) => content.includes("test.ts")),
            ).toBeInTheDocument();
        });

        it("renders status badge", () => {
            renderFileDiff();
            expect(
                screen.getByText((content) =>
                    content.toLowerCase().includes("modified"),
                ),
            ).toBeInTheDocument();
        });

        it("renders additions counter", () => {
            renderFileDiff();
            expect(screen.getByText("+5")).toBeInTheDocument();
        });

        it("renders deletions counter", () => {
            renderFileDiff();
            expect(screen.getByText("-2")).toBeInTheDocument();
        });

        it("renders file-level comment button (MessageSquare)", () => {
            renderFileDiff();
            expect(screen.getByTestId("message-square")).toBeInTheDocument();
        });

        it("renders viewed checkbox", () => {
            renderFileDiff();
            expect(screen.getByLabelText("Viewed")).toBeInTheDocument();
        });
    });

    describe("file-level comment toggle", () => {
        it("clicking MessageSquare opens MarkdownEditor", async () => {
            const user = userEvent.setup();
            renderFileDiff();

            expect(
                screen.queryByTestId("markdown-editor"),
            ).not.toBeInTheDocument();

            await user.click(screen.getByTestId("message-square"));

            expect(screen.getByTestId("markdown-editor")).toBeInTheDocument();
        });

        it("clicking MessageSquare again closes MarkdownEditor", async () => {
            const user = userEvent.setup();
            renderFileDiff();

            await user.click(screen.getByTestId("message-square"));
            expect(screen.getByTestId("markdown-editor")).toBeInTheDocument();

            await user.click(screen.getByTestId("message-square"));
            expect(
                screen.queryByTestId("markdown-editor"),
            ).not.toBeInTheDocument();
        });
    });

    describe("file-level comment threads", () => {
        it("renders file-level comment threads above the diff", () => {
            renderFileDiff({
                comments: [
                    {
                        id: 1,
                        path: "test.ts",
                        subject_type: "file",
                        body: "File-level comment",
                    } as never,
                ],
            });

            const thread = screen.getByTestId("inline-comment-thread");
            expect(thread).toBeInTheDocument();
            expect(thread).toHaveTextContent("File-level comment");
        });

        it("does not render file-level threads when showComments is false", () => {
            renderFileDiff({
                comments: [
                    {
                        id: 1,
                        path: "test.ts",
                        subject_type: "file",
                        body: "File-level comment",
                    } as never,
                ],
                showComments: false,
            });

            expect(
                screen.queryByTestId("inline-comment-thread"),
            ).not.toBeInTheDocument();
        });
    });

    describe("expand / collapse all", () => {
        it("renders expand/collapse all button", () => {
            renderFileDiff();
            expect(screen.getByTestId("unfold-icon")).toBeInTheDocument();
        });

        it("clicking expand-all toggles to collapse-all icon", async () => {
            const user = userEvent.setup();
            renderFileDiff();

            const expandBtn = screen.getByTestId("unfold-icon");
            await user.click(expandBtn.closest("button") ?? expandBtn);

            expect(screen.getByTestId("fold-icon")).toBeInTheDocument();
            expect(screen.queryByTestId("unfold-icon")).not.toBeInTheDocument();
        });

        it("passes expandAllContext prop to DiffView when toggled", async () => {
            const user = userEvent.setup();
            renderFileDiff();

            let diffView = screen.getByTestId("diff-view");
            expect(diffView).toHaveAttribute("data-expand-all", "false");

            const expandBtn = screen.getByTestId("unfold-icon");
            await user.click(expandBtn.closest("button") ?? expandBtn);

            diffView = screen.getByTestId("diff-view");
            expect(diffView).toHaveAttribute("data-expand-all", "true");
        });
    });

    describe("comment visibility (showComments)", () => {
        it("passes showComments=true to DiffView when showComments is true", () => {
            renderFileDiff({ showComments: true });

            const diffView = screen.getByTestId("diff-view");
            expect(diffView).toHaveAttribute("data-show-comments", "true");
        });

        it("passes showComments=false to DiffView when showComments is false", () => {
            renderFileDiff({ showComments: false });

            const diffView = screen.getByTestId("diff-view");
            expect(diffView).toHaveAttribute("data-show-comments", "false");
        });
    });

    describe("DiffView rendering", () => {
        it("renders DiffView for files with a patch", () => {
            renderFileDiff();
            expect(screen.getByTestId("diff-view")).toBeInTheDocument();
        });

        it("renders ImageDiff for images without a patch", () => {
            renderFileDiff({
                file: {
                    filename: "image.png",
                    status: "modified" as const,
                    additions: 0,
                    deletions: 0,
                    previous_filename: "old.png",
                },
                baseSha: "abc123",
            });

            expect(screen.getByTestId("image-diff")).toBeInTheDocument();
        });
    });
});
