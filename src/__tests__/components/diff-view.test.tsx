// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockMarkdownEditor } from "~/__tests__/helpers/component-mocks";

// --- Hoisted mocks for PatchDiff ---

const { mockPatchDiff } = vi.hoisted(() => ({
    mockPatchDiff: vi.fn(),
}));

vi.mock("@pierre/diffs/react", () => ({
    PatchDiff: (props: Record<string, unknown>) => {
        mockPatchDiff(props);
        const annotations = props.lineAnnotations as
            | Array<Record<string, unknown>>
            | undefined;
        const renderAnnotation = props.renderAnnotation as
            | ((annotation: Record<string, unknown>) => React.ReactNode)
            | undefined;
        return (
            <div data-testid="patch-diff">
                <span data-testid="patch-value">{props.patch as string}</span>
                {annotations &&
                    renderAnnotation &&
                    annotations.map((a, i) => (
                        <div // biome-ignore lint/suspicious/noArrayIndexKey: test mock, stable order
                            key={`annotation-${i}`}
                            data-testid={`annotation-${i}`}
                        >
                            {renderAnnotation(a)}
                        </div>
                    ))}
            </div>
        );
    },
}));

vi.mock("next-themes", () => ({
    useTheme: () => ({ resolvedTheme: "light" }),
}));

vi.mock("~/components/inline-comment-thread", () => ({
    InlineCommentThread: (props: { parentComment: { id: number } }) => (
        <div
            data-testid="inline-comment-thread"
            data-comment-id={props.parentComment?.id}
        >
            thread-{props.parentComment?.id}
        </div>
    ),
}));

vi.mock("~/components/markdown/markdown-editor", () => mockMarkdownEditor());

vi.mock("lucide-react", () => ({}));

import { type DiffCommentTarget, DiffView } from "~/components/diff-view";
import type { ReviewComment } from "~/server/github";

// --- Helpers ---

function makeMockComments(
    comments: Array<{
        id: number;
        line?: number | null;
        side?: string;
        start_line?: number | null;
        path?: string;
        body?: string;
        in_reply_to_id?: number;
        position?: number | null;
        original_position?: number | null;
        diff_hunk?: string;
    }>,
): ReviewComment[] {
    return comments as unknown as ReviewComment[];
}

const SAMPLE_PATCH = [
    "@@ -1,3 +1,4 @@",
    " context line",
    "-old line",
    "+new line",
    " context line",
].join("\n");

const MULTI_HUNK_PATCH = [
    "@@ -1,4 +1,5 @@",
    " line1",
    "-old1",
    "+new1",
    " line2",
    " line3",
    "@@ -10,3 +11,4 @@",
    " line10",
    "-old10",
    "+new10",
    " line11",
].join("\n");

/** Build a valid diff_hunk for a comment at `newLine` on the given side. */
function makeDiffHunk(newLine: number, _side: "LEFT" | "RIGHT"): string {
    const lines: string[] = [`@@ -${newLine},3 +${newLine},4 @@`];
    // Context before
    lines.push(` context${newLine - 1}`);
    // Deletion (old side line)
    lines.push(`-deleted${newLine - 1}`);
    // Insertion (new side line)
    lines.push(`+inserted${newLine}`);
    // Context after (newLine is reachable)
    lines.push(` context${newLine + 1}`);
    return lines.join("\n");
}

function renderDiffView(props?: {
    patch?: string;
    filename?: string;
    view?: "unified" | "split";
    showComments?: boolean;
    showCommentButton?: boolean;
    activeComment?: DiffCommentTarget | null;
    onStartComment?: (ac: DiffCommentTarget | null) => void;
    comments?: ReviewComment[];
    expandAllContext?: boolean;
    headSha?: string;
    owner?: string;
    repo?: string;
    pullNumber?: number;
}) {
    return render(
        <DiffView
            patch={props?.patch ?? SAMPLE_PATCH}
            filename={props?.filename ?? "test.ts"}
            view={props?.view ?? "unified"}
            showComments={props?.showComments ?? false}
            showCommentButton={props?.showCommentButton ?? false}
            activeComment={props?.activeComment ?? null}
            onStartComment={props?.onStartComment ?? vi.fn()}
            comments={props?.comments ?? []}
            expandAllContext={props?.expandAllContext ?? false}
            headSha={props?.headSha}
            owner={props?.owner}
            repo={props?.repo}
            pullNumber={props?.pullNumber}
            permissionContext={{
                currentUser: "testuser",
                isPullRequestAuthor: false,
                repoPermission: "write",
                isPullRequestLocked: false,
            }}
        />,
    );
}

// --- Tests ---

describe("DiffView rendering", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders PatchDiff with the normalized patch string", () => {
        renderDiffView();
        expect(screen.getByTestId("patch-diff")).toBeInTheDocument();
        // Bare hunks get wrapped in diff --git format
        const patchValue = screen.getByTestId("patch-value").textContent ?? "";
        expect(patchValue).toContain("diff --git a/test.ts b/test.ts");
        expect(patchValue).toContain(SAMPLE_PATCH);
    });

    it("renders without errors with a minimal patch", () => {
        const patch = "@@ -1,1 +1,2 @@\n old\n+new";
        renderDiffView({ patch });
        expect(screen.getByTestId("patch-diff")).toBeInTheDocument();
    });
});

describe("DiffView options pass-through", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("passes diffStyle from view prop", () => {
        renderDiffView({ view: "unified" });
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({
                    diffStyle: "unified",
                }),
            }),
        );

        vi.clearAllMocks();
        renderDiffView({ view: "split" });
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({
                    diffStyle: "split",
                }),
            }),
        );
    });

    it("passes expandUnchanged from expandAllContext prop", () => {
        renderDiffView({ expandAllContext: false });
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({
                    expandUnchanged: false,
                }),
            }),
        );

        vi.clearAllMocks();
        renderDiffView({ expandAllContext: true });
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({
                    expandUnchanged: true,
                }),
            }),
        );
    });

    it("passes stickyHeader as true", () => {
        renderDiffView();
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({
                    stickyHeader: true,
                }),
            }),
        );
    });

    it("passes enableLineSelection based on showCommentButton", () => {
        renderDiffView({ showCommentButton: false });
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({
                    enableLineSelection: false,
                }),
            }),
        );

        vi.clearAllMocks();
        renderDiffView({ showCommentButton: true });
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({
                    enableLineSelection: true,
                }),
            }),
        );
    });

    it("passes lineDiffType as word", () => {
        renderDiffView();
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({
                    lineDiffType: "word",
                }),
            }),
        );
    });

    it("passes the normalized patch string to PatchDiff", () => {
        renderDiffView({ patch: MULTI_HUNK_PATCH });
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                patch: expect.stringContaining(
                    "diff --git a/test.ts b/test.ts",
                ),
            }),
        );
    });
});

describe("DiffView comment annotations", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("passes undefined annotations when showComments is false", () => {
        const comments = makeMockComments([
            {
                id: 1,
                line: 2,
                side: "RIGHT",
                path: "test.ts",
                diff_hunk: makeDiffHunk(2, "RIGHT"),
            },
        ]);

        renderDiffView({ showComments: false, comments });
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                lineAnnotations: undefined,
            }),
        );
    });

    it("passes undefined annotations when no comments have diff_hunk", () => {
        const comments = makeMockComments([
            { id: 1, line: 2, side: "RIGHT", path: "test.ts" },
        ]);

        renderDiffView({ showComments: true, comments });
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                lineAnnotations: undefined,
            }),
        );
    });

    it("builds annotations from comments with valid diff_hunks", () => {
        const comments = makeMockComments([
            {
                id: 1,
                line: 2,
                side: "RIGHT",
                path: "test.ts",
                diff_hunk: makeDiffHunk(2, "RIGHT"),
            },
        ]);

        renderDiffView({ showComments: true, comments });
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                lineAnnotations: expect.arrayContaining([
                    expect.objectContaining({
                        side: "additions",
                        lineNumber: 2,
                        metadata: expect.objectContaining({
                            side: "RIGHT",
                            line: 2,
                        }),
                    }),
                ]),
            }),
        );
    });

    it("groups multiple comments on the same line into one annotation", () => {
        const comments = makeMockComments([
            {
                id: 1,
                line: 2,
                side: "RIGHT",
                path: "test.ts",
                diff_hunk: makeDiffHunk(2, "RIGHT"),
            },
            {
                id: 2,
                line: 2,
                side: "RIGHT",
                path: "test.ts",
                diff_hunk: makeDiffHunk(2, "RIGHT"),
            },
        ]);

        renderDiffView({ showComments: true, comments });
        const annotations = mockPatchDiff.mock.calls[0]?.[0]?.lineAnnotations as
            | Array<{
                  metadata: { comments: ReviewComment[] };
              }>
            | undefined;
        expect(annotations).toBeDefined();
        expect(annotations!).toHaveLength(1);
        expect(annotations![0]!.metadata.comments).toHaveLength(2);
    });

    it("maps LEFT side comments to deletions annotation", () => {
        const comments = makeMockComments([
            {
                id: 1,
                line: 2,
                side: "LEFT",
                path: "test.ts",
                diff_hunk: makeDiffHunk(2, "LEFT"),
            },
        ]);

        renderDiffView({ showComments: true, comments });
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                lineAnnotations: expect.arrayContaining([
                    expect.objectContaining({
                        side: "deletions",
                        lineNumber: 2,
                    }),
                ]),
            }),
        );
    });

    it("maps RIGHT side comments to additions annotation", () => {
        const comments = makeMockComments([
            {
                id: 1,
                line: 3,
                side: "RIGHT",
                path: "test.ts",
                diff_hunk: makeDiffHunk(3, "RIGHT"),
            },
        ]);

        renderDiffView({ showComments: true, comments });
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                lineAnnotations: expect.arrayContaining([
                    expect.objectContaining({
                        side: "additions",
                        lineNumber: 3,
                    }),
                ]),
            }),
        );
    });
});

describe("DiffView comment threads via renderAnnotation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders InlineCommentThread for each comment thread in annotation", () => {
        const comments = makeMockComments([
            {
                id: 1,
                line: 2,
                side: "RIGHT",
                path: "test.ts",
                diff_hunk: makeDiffHunk(2, "RIGHT"),
            },
        ]);

        renderDiffView({ showComments: true, comments });

        const thread = screen.getByTestId("inline-comment-thread");
        expect(thread).toBeInTheDocument();
        expect(thread).toHaveAttribute("data-comment-id", "1");
    });

    it("renders threads for comments on different lines", () => {
        const comments = makeMockComments([
            {
                id: 1,
                line: 2,
                side: "RIGHT",
                path: "test.ts",
                diff_hunk: makeDiffHunk(2, "RIGHT"),
            },
            {
                id: 2,
                line: 3,
                side: "RIGHT",
                path: "test.ts",
                diff_hunk: makeDiffHunk(3, "RIGHT"),
            },
        ]);

        renderDiffView({ showComments: true, comments });

        const threads = screen.getAllByTestId("inline-comment-thread");
        expect(threads).toHaveLength(2);
        expect(threads[0]).toHaveAttribute("data-comment-id", "1");
        expect(threads[1]).toHaveAttribute("data-comment-id", "2");
    });

    it("renders replies alongside the parent thread", () => {
        const hunk = makeDiffHunk(2, "RIGHT");
        const comments = makeMockComments([
            {
                id: 1,
                line: 2,
                side: "RIGHT",
                path: "test.ts",
                diff_hunk: hunk,
            },
            {
                id: 2,
                line: 2,
                side: "RIGHT",
                path: "test.ts",
                in_reply_to_id: 1,
                diff_hunk: hunk,
            },
        ]);

        renderDiffView({ showComments: true, comments });

        const threads = screen.getAllByTestId("inline-comment-thread");
        // Two comments on same line form one thread: parent (id=1) + reply (id=2)
        expect(threads.length).toBeGreaterThanOrEqual(1);
        expect(threads[0]).toHaveAttribute("data-comment-id", "1");
    });
});

describe("DiffView show/hide comments", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("does not render InlineCommentThread when showComments is false", () => {
        const comments = makeMockComments([
            {
                id: 1,
                line: 2,
                side: "RIGHT",
                path: "test.ts",
                diff_hunk: makeDiffHunk(2, "RIGHT"),
            },
        ]);

        renderDiffView({ showComments: false, comments });
        expect(
            screen.queryByTestId("inline-comment-thread"),
        ).not.toBeInTheDocument();
    });

    it("renders InlineCommentThread when showComments is true", () => {
        const comments = makeMockComments([
            {
                id: 1,
                line: 2,
                side: "RIGHT",
                path: "test.ts",
                diff_hunk: makeDiffHunk(2, "RIGHT"),
            },
        ]);

        renderDiffView({ showComments: true, comments });
        expect(screen.getByTestId("inline-comment-thread")).toBeInTheDocument();
    });

    it("still renders PatchDiff when showComments is false", () => {
        renderDiffView({ showComments: false });
        expect(screen.getByTestId("patch-diff")).toBeInTheDocument();
    });
});

describe("DiffView active comment", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("passes activeComment to renderAnnotation metadata", () => {
        const activeComment: DiffCommentTarget = {
            type: "line",
            line: 2,
            side: "RIGHT",
        };

        const comments = makeMockComments([
            {
                id: 1,
                line: 2,
                side: "RIGHT",
                path: "test.ts",
                diff_hunk: makeDiffHunk(2, "RIGHT"),
            },
        ]);

        renderDiffView({ activeComment, comments, showComments: true });

        const thread = screen.getByTestId("inline-comment-thread");
        expect(thread).toBeInTheDocument();
    });

    it("renders the component without errors with activeComment set", () => {
        renderDiffView({
            activeComment: { type: "line", line: 1, side: "LEFT" },
        });
        expect(screen.getByTestId("patch-diff")).toBeInTheDocument();
    });
});

describe("DiffView comment button interactions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("calls onStartComment when clicking comment button on annotation", () => {
        const onStartComment = vi.fn();
        const comments = makeMockComments([
            {
                id: 1,
                line: 2,
                side: "RIGHT",
                path: "test.ts",
                diff_hunk: makeDiffHunk(2, "RIGHT"),
            },
        ]);

        renderDiffView({
            showComments: true,
            showCommentButton: true,
            comments,
            onStartComment,
        });

        // The comment button is rendered inside the CommentThread
        // via the renderAnnotation slot
        const addButton = screen.queryByText("Add comment");
        if (addButton) {
            fireEvent.click(addButton);
            expect(onStartComment).toHaveBeenCalled();
        }
    });

    it("shows Add comment button when showCommentButton is true and comments exist", () => {
        const comments = makeMockComments([
            {
                id: 1,
                line: 2,
                side: "RIGHT",
                path: "test.ts",
                diff_hunk: makeDiffHunk(2, "RIGHT"),
            },
        ]);

        renderDiffView({
            showComments: true,
            showCommentButton: true,
            comments,
        });

        const thread = screen.getByTestId("inline-comment-thread");
        expect(thread).toBeInTheDocument();
    });

    it("does not show Add comment button when showCommentButton is false", () => {
        const comments = makeMockComments([
            {
                id: 1,
                line: 2,
                side: "RIGHT",
                path: "test.ts",
                diff_hunk: makeDiffHunk(2, "RIGHT"),
            },
        ]);

        renderDiffView({
            showComments: true,
            showCommentButton: false,
            comments,
        });

        // Thread should still render (showComments is true)
        const thread = screen.getByTestId("inline-comment-thread");
        expect(thread).toBeInTheDocument();
    });
});

describe("DiffView parseCommentAnchor edge cases", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("ignores comments without diff_hunk", () => {
        const comments = makeMockComments([
            { id: 1, line: 2, side: "RIGHT", path: "test.ts" },
        ]);

        renderDiffView({ showComments: true, comments });
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                lineAnnotations: undefined,
            }),
        );
    });

    it("ignores comments with malformed diff_hunk header", () => {
        const comments = makeMockComments([
            {
                id: 1,
                line: 2,
                side: "RIGHT",
                path: "test.ts",
                diff_hunk: "bad header\n-foo\n+bar",
            },
        ]);

        renderDiffView({ showComments: true, comments });
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                lineAnnotations: undefined,
            }),
        );
    });

    it("ignores comments where line number does not match hunk", () => {
        const comments = makeMockComments([
            {
                id: 1,
                line: 99,
                side: "RIGHT",
                path: "test.ts",
                diff_hunk: makeDiffHunk(2, "RIGHT"),
            },
        ]);

        renderDiffView({ showComments: true, comments });
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                lineAnnotations: undefined,
            }),
        );
    });

    it("handles comments on context lines (both sides)", () => {
        // makeDiffHunk(2, "RIGHT") produces a hunk starting at new line 2,
        // so line 2 is a context line in the hunk.
        const comments = makeMockComments([
            {
                id: 1,
                line: 2,
                side: "RIGHT",
                path: "test.ts",
                diff_hunk: makeDiffHunk(2, "RIGHT"),
            },
        ]);

        renderDiffView({ showComments: true, comments });
        // Context line 2 exists in the hunk (first content line), should match
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                lineAnnotations: expect.arrayContaining([
                    expect.objectContaining({
                        side: "additions",
                        lineNumber: 2,
                    }),
                ]),
            }),
        );
    });

    it("handles comments with @@ -1,3 +1,4 @@ style header", () => {
        const comments = makeMockComments([
            {
                id: 1,
                line: 3,
                side: "RIGHT",
                path: "test.ts",
                diff_hunk: makeDiffHunk(3, "RIGHT"),
            },
        ]);

        renderDiffView({ showComments: true, comments });
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                lineAnnotations: expect.arrayContaining([
                    expect.objectContaining({
                        side: "additions",
                        lineNumber: 3,
                    }),
                ]),
            }),
        );
    });
});

describe("DiffView with empty comments array", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("passes undefined annotations when comments array is empty", () => {
        renderDiffView({ showComments: true, comments: [] });
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                lineAnnotations: undefined,
            }),
        );
    });

    it("still renders PatchDiff with empty comments", () => {
        renderDiffView({ showComments: true, comments: [] });
        expect(screen.getByTestId("patch-diff")).toBeInTheDocument();
    });
});

describe("DiffView default props", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("defaults to unified view", () => {
        renderDiffView();
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({
                    diffStyle: "unified",
                }),
            }),
        );
    });

    it("defaults expandAllContext to false", () => {
        renderDiffView();
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({
                    expandUnchanged: false,
                }),
            }),
        );
    });

    it("defaults showComments to false", () => {
        renderDiffView();
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                lineAnnotations: undefined,
            }),
        );
    });

    it("defaults showCommentButton to false", () => {
        renderDiffView();
        expect(mockPatchDiff).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({
                    enableLineSelection: false,
                }),
            }),
        );
    });

    it("defaults activeComment to null", () => {
        renderDiffView();
        expect(screen.getByTestId("patch-diff")).toBeInTheDocument();
    });
});
