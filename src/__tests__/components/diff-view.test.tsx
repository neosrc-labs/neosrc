// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockMarkdownEditor } from "~/__tests__/helpers/component-mocks";
import { filenameHash } from "~/utils/filename-hash";

const { mockParse, mockHighlight, mockUseFileContent } = vi.hoisted(() => ({
    mockParse: vi.fn(),
    mockHighlight: vi.fn((text: string, _opts: unknown) => ({ value: text })),
    mockUseFileContent: {
        lines: null as string[] | null,
        isLoading: false,
        error: null,
    },
}));

vi.mock("diff2html", () => ({
    parse: mockParse,
    defaultDiff2HtmlConfig: { colorScheme: "light", rawTemplates: {} },
}));

vi.mock("highlight.js", () => ({
    default: {
        highlight: mockHighlight,
        getLanguage: vi.fn(() => true),
    },
}));

vi.mock("next-themes", () => ({
    useTheme: () => ({ resolvedTheme: "light" }),
}));

vi.mock("~/hooks/use-file-content", () => ({
    useFileContent: vi.fn(() => ({
        lines: mockUseFileContent.lines,
        isLoading: mockUseFileContent.isLoading,
        error: mockUseFileContent.error,
    })),
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

vi.mock("lucide-react", () => ({
    Plus: (props: Record<string, unknown>) => (
        <button
            type="button"
            data-testid="square-plus"
            className={props.className as string}
            onMouseDown={props.onMouseDown as React.MouseEventHandler}
            onClick={props.onClick as React.MouseEventHandler}
        />
    ),
    UnfoldVertical: () => <div data-testid="unfold-icon" />,
    FoldVertical: () => <div data-testid="fold-icon" />,
    ArrowDownFromLine: () => <div data-testid="arrow-down-from-line" />,
    ArrowUpFromLine: () => <div data-testid="arrow-up-from-line" />,
    MessageSquare: () => <div data-testid="message-square" />,
    MessageSquareOff: () => <div data-testid="message-square-off" />,
}));

import { type DiffCommentTarget, DiffView } from "~/components/diff-view";
import type { ReviewComment } from "~/server/github";

// --- Helpers ---

type MockLine = {
    type: string;
    oldNumber?: number;
    newNumber?: number;
    content: string;
};

type MockBlock = {
    oldStartLine: number;
    newStartLine: number;
    header: string;
    lines: MockLine[];
};

function mc(content: string, newNum?: number, oldNum?: number): MockLine {
    return {
        type:
            oldNum != null && newNum == null
                ? "delete"
                : newNum != null && oldNum == null
                  ? "insert"
                  : "context",
        oldNumber: oldNum,
        newNumber: newNum,
        content,
    };
}

function mb(
    startLine: number,
    lines: MockLine[],
    oldStartLine?: number,
): MockBlock {
    return {
        oldStartLine: oldStartLine ?? startLine,
        newStartLine: startLine,
        header: `@@ -${oldStartLine ?? startLine},${lines.length} +${startLine},${lines.length} @@`,
        lines,
    };
}

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
    }>,
): ReviewComment[] {
    return comments as unknown as ReviewComment[];
}

function mockParsedFile(
    blocks: MockBlock[],
    options?: { addedLines?: number; deletedLines?: number },
) {
    mockParse.mockReturnValue([
        {
            addedLines: options?.addedLines ?? 0,
            deletedLines: options?.deletedLines ?? 0,
            isCombined: false,
            isGitDiff: true,
            language: "",
            oldName: "a/test.ts",
            newName: "b/test.ts",
            blocks,
        },
    ]);
}

const FILE_HASH = filenameHash("test.ts");

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
            patch={props?.patch ?? "non-empty-patch"}
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

function getTr(container: HTMLElement, suffix: string): HTMLElement | null {
    return container.querySelector(`tr[id$="${suffix}"]`);
}

function renderCommentButton(
    onStartComment: (ac: DiffCommentTarget | null) => void,
) {
    const lines = [mc(" line1", 1, 1), mc("+line2", 2)];
    mockParsedFile([mb(1, lines)], { addedLines: 1 });
    const { container } = renderDiffView({
        showCommentButton: true,
        onStartComment,
    });
    return {
        container,
        firstPlus: container.querySelector('[data-testid="square-plus"]'),
    };
}

// --- Tests ---

describe("DiffView rendering", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("basic rendering", () => {
        it("renders diff lines from parsed blocks", () => {
            const lines = [
                mc(" line1", 1, 1),
                mc("+line2", 2),
                mc("-line3", undefined, 3),
            ];
            mockParsedFile([mb(1, lines)], {
                addedLines: 1,
                deletedLines: 1,
            });

            const { container } = renderDiffView({ showCommentButton: true });

            expect(container.textContent).toContain("line1");
            expect(container.textContent).toContain("line2");
            expect(container.textContent).toContain("line3");
        });
    });

    describe("line linking / permalinks", () => {
        beforeEach(() => {
            vi.spyOn(window.history, "replaceState").mockImplementation(
                vi.fn(),
            );
        });

        it("clicking a line number updates the URL with a single-line hash", async () => {
            const user = userEvent.setup();
            const lines = [mc(" line1", 1, 1), mc(" line2", 2, 2)];
            mockParsedFile([mb(1, lines)]);

            const { container } = renderDiffView();
            const lineNumCell = container.querySelector(
                "td.d2h-code-linenumber",
            );
            expect(lineNumCell).toBeTruthy();

            await user.click(lineNumCell!);

            expect(window.history.replaceState).toHaveBeenCalledWith(
                null,
                "",
                expect.stringMatching(new RegExp(`#diff-${FILE_HASH}R1$`)),
            );
        });

        it("shift+clicking two line numbers updates URL to a range", async () => {
            const user = userEvent.setup();
            const lines = [mc(" line1", 1, 1), mc(" line2", 2, 2)];
            mockParsedFile([mb(1, lines)]);

            const { container } = renderDiffView();
            const cells = container.querySelectorAll("td.d2h-code-linenumber");
            expect(cells.length).toBeGreaterThanOrEqual(2);

            await user.click(cells[0]!);
            await user.keyboard("{Shift>}");
            await user.click(cells[1]!);
            await user.keyboard("{/Shift}");

            expect(window.history.replaceState).toHaveBeenLastCalledWith(
                null,
                "",
                expect.stringMatching(new RegExp(`#diff-${FILE_HASH}R1-R2$`)),
            );
        });
    });

    describe("comment button interactions", () => {
        it("clicking Plus calls onStartComment with single line", () => {
            const onStartComment = vi.fn();
            const { firstPlus } = renderCommentButton(onStartComment);
            expect(firstPlus).toBeTruthy();

            fireEvent.click(firstPlus!);

            expect(onStartComment).toHaveBeenCalledWith({
                type: "line",
                line: 1,
                side: "RIGHT",
            });
        });

        it("clicking Plus when activeComment is active toggles it off", () => {
            const onStartComment = vi.fn();
            const lines = [mc(" line1", 1, 1)];
            mockParsedFile([mb(1, lines)]);

            const { container } = renderDiffView({
                showCommentButton: true,
                onStartComment,
                activeComment: { type: "line", line: 1, side: "RIGHT" },
            });

            const firstPlus = container.querySelector(
                '[data-testid="square-plus"]',
            );
            fireEvent.click(firstPlus!);

            expect(onStartComment).toHaveBeenCalledWith(null);
        });

        it("shift+click Plus with active comment extends range", () => {
            const onStartComment = vi.fn();
            const lines = [
                mc(" line1", 1, 1),
                mc("+line2", 2),
                mc("+line3", 3),
            ];
            mockParsedFile([mb(1, lines)], { addedLines: 2 });

            const { container } = renderDiffView({
                showCommentButton: true,
                onStartComment,
                activeComment: { type: "line", line: 1, side: "RIGHT" },
            });

            const buttons = container.querySelectorAll(
                '[data-testid="square-plus"]',
            );
            const thirdButton = buttons[2];
            expect(thirdButton).toBeTruthy();

            fireEvent.click(thirdButton!, { shiftKey: true });

            expect(onStartComment).toHaveBeenCalledWith({
                type: "line",
                line: 3,
                side: "RIGHT",
                startLine: 1,
                startSide: "RIGHT",
            });
        });

        it("MarkdownEditor renders when line is active", () => {
            const lines = [mc(" line1", 1, 1)];
            mockParsedFile([mb(1, lines)]);

            renderDiffView({
                showCommentButton: true,
                activeComment: { type: "line", line: 1, side: "RIGHT" },
            });

            expect(screen.getByTestId("markdown-editor")).toBeInTheDocument();
        });

        it("MarkdownEditor not rendered when line is not active", () => {
            const lines = [mc(" line1", 1, 1)];
            mockParsedFile([mb(1, lines)]);

            renderDiffView({ showCommentButton: true });

            expect(
                screen.queryByTestId("markdown-editor"),
            ).not.toBeInTheDocument();
        });
    });

    describe("drag-to-select multi-line comments", () => {
        it("mouseDown on Plus, mouseOver on different line, mouseUp calls onStartComment with range", () => {
            const onStartComment = vi.fn();
            const { container, firstPlus } =
                renderCommentButton(onStartComment);
            expect(firstPlus).toBeTruthy();

            // mousedown on first line's button starts drag
            fireEvent.mouseDown(firstPlus!);

            // mouseover on second line extends range
            const tr2 = getTr(container, "R2");
            expect(tr2).toBeTruthy();
            fireEvent.mouseOver(tr2!);

            // mouseup on document finalizes
            fireEvent.mouseUp(document);

            expect(onStartComment).toHaveBeenCalledWith({
                type: "line",
                line: 2,
                side: "RIGHT",
                startLine: 1,
                startSide: "RIGHT",
            });
        });
    });

    describe("comment display", () => {
        it("renders InlineCommentThread when showComments is true and comments exist", () => {
            const lines = [mc(" line1", 1, 1)];
            mockParsedFile([mb(1, lines)]);

            const comments = makeMockComments([
                { id: 1, line: 1, side: "RIGHT", path: "test.ts" },
            ]);

            renderDiffView({ showComments: true, comments });

            const thread = screen.getByTestId("inline-comment-thread");
            expect(thread).toBeInTheDocument();
            expect(thread).toHaveAttribute("data-comment-id", "1");
        });

        it("does not render InlineCommentThread when showComments is false", () => {
            const lines = [mc(" line1", 1, 1)];
            mockParsedFile([mb(1, lines)]);

            const comments = makeMockComments([
                { id: 1, line: 1, side: "RIGHT", path: "test.ts" },
            ]);

            renderDiffView({ showComments: false, comments });

            expect(
                screen.queryByTestId("inline-comment-thread"),
            ).not.toBeInTheDocument();
        });

        it("anchors draft comments (position only, no line/side) to the correct diff line", () => {
            const lines = [mc(" ctx", 10, 10), mc("+added", 11)];
            mockParsedFile([mb(10, lines, 10)], { addedLines: 1 });

            const comments = makeMockComments([
                { id: 99, position: 2, path: "test.ts" },
            ]);

            renderDiffView({
                showComments: true,
                comments,
            });

            const thread = screen.getByTestId("inline-comment-thread");
            expect(thread).toHaveAttribute("data-comment-id", "99");

            // The thread must be anchored to new line 11 (insert), not diff
            // position 2: its row immediately follows the R11 line row.
            const threadRow = thread.closest("tr");
            const lineRow = threadRow?.previousElementSibling;
            expect(lineRow?.id.endsWith("R11")).toBe(true);
        });
    });

    describe("multi-line range indicator", () => {
        it("shows blue left border on intermediate lines of a multi-line comment", () => {
            const lines = [mc(" line1", 1, 1), mc("+line2", 2)];
            mockParsedFile([mb(1, lines)], { addedLines: 1 });

            const comments = makeMockComments([
                {
                    id: 1,
                    line: 2,
                    side: "RIGHT",
                    start_line: 1,
                    path: "test.ts",
                },
            ]);

            const { container } = renderDiffView({
                showComments: true,
                comments,
            });

            // Line 1 (intermediate) should have blue left border
            const lineNumCells = container.querySelectorAll(
                "td.d2h-code-linenumber",
            );
            const firstCell = lineNumCells[0];
            expect(firstCell?.className).toContain("border-l-4");
            expect(firstCell?.className).toContain("border-blue-400");

            // Thread (InlineCommentThread) only on line 2 (last line of range)
            const threads = screen.getAllByTestId("inline-comment-thread");
            expect(threads).toHaveLength(1);
        });

        it("single-line comment has no blue left border", () => {
            const lines = [mc(" line1", 1, 1)];
            mockParsedFile([mb(1, lines)]);

            const comments = makeMockComments([
                { id: 1, line: 1, side: "RIGHT", path: "test.ts" },
            ]);

            const { container } = renderDiffView({
                showComments: true,
                comments,
            });

            const lineNumCells = container.querySelectorAll(
                "td.d2h-code-linenumber",
            );
            expect(lineNumCells[0]?.className).not.toContain("border-l-4");
        });
    });

    describe("context expansion", () => {
        beforeEach(() => {
            mockUseFileContent.lines = [
                "line1",
                "line2",
                "line3",
                "line4",
                "line5",
                "line6",
            ];
            mockUseFileContent.isLoading = false;
            mockUseFileContent.error = null;
        });

        it("renders directional expand buttons in the gap row between hunks", () => {
            const block1 = mb(1, [mc(" line1", 1, 1), mc("+line2", 2)]);
            const block2 = mb(5, [mc(" line5", 5, 5)]);
            mockParsedFile([block1, block2], { addedLines: 1 });

            const { container } = renderDiffView({
                expandAllContext: false,
                headSha: "mock-sha",
                owner: "owner",
                repo: "repo",
                pullNumber: 1,
            });

            // The gap row between hunks (line 3-4) holds both directional
            // buttons: expand-down on the left, expand-up on the right.
            const rows = Array.from(container.querySelectorAll("tr"));
            const gapRow = rows.find(
                (tr) =>
                    tr.querySelector('[data-testid="arrow-down-from-line"]') &&
                    tr.querySelector('[data-testid="arrow-up-from-line"]'),
            );
            expect(gapRow).toBeDefined();
            // The git hunk marker stays visible in the same row.
            expect(gapRow?.textContent).toContain("@@ -5,1 +5,1 @@");
        });
    });

    describe("expandAllContext", () => {
        beforeEach(() => {
            mockUseFileContent.lines = [
                "line1",
                "line2",
                "line3",
                "line4",
                "line5",
                "line6",
            ];
            mockUseFileContent.isLoading = false;
            mockUseFileContent.error = null;
        });

        it("expandAllContext true expands all gaps (no expand buttons)", () => {
            const block1 = mb(1, [mc(" line1", 1, 1), mc("+line2", 2)]);
            const block2 = mb(5, [mc(" line5", 5, 5)]);
            mockParsedFile([block1, block2], { addedLines: 1 });

            const { container } = renderDiffView({
                expandAllContext: true,
                headSha: "mock-sha",
                owner: "owner",
                repo: "repo",
                pullNumber: 1,
            });

            expect(
                container.querySelectorAll('[data-testid="unfold-icon"]')
                    .length,
            ).toBe(0);
            expect(
                container.querySelectorAll(
                    '[data-testid="arrow-down-from-line"]',
                ).length,
            ).toBe(0);
            expect(
                container.querySelectorAll('[data-testid="arrow-up-from-line"]')
                    .length,
            ).toBe(0);
        });
    });

    describe("gap edge cases", () => {
        beforeEach(() => {
            mockUseFileContent.lines = [
                "line1",
                "line2",
                "line3",
                "line4",
                "line5",
            ];
            mockUseFileContent.isLoading = false;
            mockUseFileContent.error = null;
        });

        it("does not render gap row when blocks are adjacent (no missing lines)", () => {
            // Block 1 ends at line 2, block 2 starts at line 3 -- no gap
            const block1 = mb(1, [mc(" line1", 1, 1), mc(" line2", 2, 2)]);
            const block2 = mb(3, [mc(" line3", 3, 3)]);
            mockParsedFile([block1, block2]);

            const { container } = renderDiffView({
                headSha: "mock-sha",
                owner: "owner",
                repo: "repo",
                pullNumber: 1,
            });

            // Only the trailing gap renders an expand-down button; adjacent
            // blocks mean no between-block gap at all.
            const downButtons = container.querySelectorAll(
                '[data-testid="arrow-down-from-line"]',
            );
            const upButtons = container.querySelectorAll(
                '[data-testid="arrow-up-from-line"]',
            );
            expect(downButtons.length).toBeLessThanOrEqual(1);
            expect(upButtons.length).toBe(0);
        });

        it("renders loading state when gap is expanded and file content is loading", () => {
            mockUseFileContent.isLoading = true;
            const lines = [mc(" line1", 1, 1), mc("+line2", 2)];
            mockParsedFile([mb(1, lines)], { addedLines: 1 });

            // Trailing gap with expandAllContext to force expand
            renderDiffView({
                expandAllContext: true,
                headSha: "mock-sha",
                owner: "owner",
                repo: "repo",
                pullNumber: 1,
            });

            // Should find loading indicators in the table
            const infoCells = document.querySelectorAll(".d2h-info");
            expect(infoCells.length).toBeGreaterThan(0);
        });
    });

    describe("progressive gap expansion", () => {
        beforeEach(() => {
            mockUseFileContent.lines = Array.from(
                { length: 100 },
                (_, i) => `line${i + 1}`,
            );
            mockUseFileContent.isLoading = false;
            mockUseFileContent.error = null;
        });

        function gapRowNumbers(container: HTMLElement) {
            return Array.from(container.querySelectorAll('tr[id^="diff-"]'))
                .map((tr) => Number(tr.id.split("R")[1]))
                .filter((n) => n >= 11 && n <= 90);
        }

        it("expands 20 lines per click until the gap is exhausted", () => {
            // Block 1 covers lines 1-10, block 2 starts at 91 -> gap 11-90 (80 lines)
            const block1 = mb(
                1,
                Array.from({ length: 10 }, (_, i) =>
                    mc(` line${i + 1}`, i + 1, i + 1),
                ),
            );
            const block2 = mb(91, [mc(" line91", 91, 91)]);
            mockParsedFile([block1, block2]);

            const { container } = renderDiffView({
                headSha: "mock-sha",
                owner: "owner",
                repo: "repo",
                pullNumber: 1,
            });

            const clickDown = () => {
                const btn = container.querySelector(
                    '[data-testid="arrow-up-from-line"]',
                );
                fireEvent.click(btn!);
            };

            // Middle gap (11-90) shows both directional buttons; the trailing
            // gap (92-100) shows a single expand-down button.
            expect(
                container.querySelectorAll(
                    '[data-testid="arrow-down-from-line"]',
                ).length,
            ).toBe(2);
            expect(
                container.querySelectorAll('[data-testid="arrow-up-from-line"]')
                    .length,
            ).toBe(1);
            expect(gapRowNumbers(container)).toHaveLength(0);

            // Click 1: the 20 lines at the bottom of the gap (71-90),
            // revealed below the unfold row, toward the next hunk.
            clickDown();
            let nums = gapRowNumbers(container);
            expect(nums).toHaveLength(20);
            expect(nums[0]).toBe(71);
            expect(nums[19]).toBe(90);

            const rows = Array.from(container.querySelectorAll("tr"));
            const unfoldRowIdx = rows.findIndex((tr) =>
                tr.querySelector('[data-testid="arrow-down-from-line"]'),
            );
            const firstBottomIdx = rows.findIndex((tr) =>
                tr.id?.endsWith("R71"),
            );
            const blockStartIdx = rows.findIndex((tr) =>
                tr.id?.endsWith("R91"),
            );
            expect(unfoldRowIdx).toBeGreaterThanOrEqual(0);
            expect(firstBottomIdx).toBeGreaterThan(unfoldRowIdx);
            expect(blockStartIdx).toBeGreaterThan(firstBottomIdx);

            // Click 2: 51-90
            clickDown();
            nums = gapRowNumbers(container);
            expect(nums).toHaveLength(40);
            expect(nums[0]).toBe(51);
            expect(nums[39]).toBe(90);

            // Click 3: 31-90
            clickDown();
            nums = gapRowNumbers(container);
            expect(nums).toHaveLength(60);
            expect(nums[0]).toBe(31);
            expect(nums[59]).toBe(90);

            // Click 4: gap exhausted, middle buttons disappear
            clickDown();
            nums = gapRowNumbers(container);
            expect(nums).toHaveLength(80);
            expect(nums[0]).toBe(11);
            expect(nums[79]).toBe(90);
            expect(
                container.querySelectorAll(
                    '[data-testid="arrow-down-from-line"]',
                ).length,
            ).toBe(1);
            expect(
                container.querySelectorAll('[data-testid="arrow-up-from-line"]')
                    .length,
            ).toBe(0);
        });

        it("shows a loading row when a middle gap expands before content loads", () => {
            // Gap 3-4 (2 lines) between block 1 (1-2) and block 2 (5)
            const block1 = mb(1, [mc(" line1", 1, 1), mc("+line2", 2)]);
            const block2 = mb(5, [mc(" line5", 5, 5)]);
            mockParsedFile([block1, block2]);
            mockUseFileContent.isLoading = true;

            const { container } = renderDiffView({
                headSha: "mock-sha",
                owner: "owner",
                repo: "repo",
                pullNumber: 1,
            });

            fireEvent.click(
                container.querySelector(
                    '[data-testid="arrow-down-from-line"]',
                )!,
            );

            // Loading row replaces the gap content: no revealed lines yet and
            // the middle gap's expand buttons are hidden while the fetch is
            // in flight (only the trailing gap keeps its button).
            const loadingRows = Array.from(
                container.querySelectorAll("tr"),
            ).filter((tr) => tr.textContent.includes("Loading"));
            expect(loadingRows.length).toBe(1);
            const rowIds = Array.from(
                container.querySelectorAll('tr[id^="diff-"]'),
            ).map((tr) => tr.id);
            expect(rowIds.some((id) => id.endsWith("R3"))).toBe(false);
            expect(
                container.querySelectorAll('[data-testid="arrow-up-from-line"]')
                    .length,
            ).toBe(0);
            expect(
                container.querySelectorAll(
                    '[data-testid="arrow-down-from-line"]',
                ).length,
            ).toBe(1);
        });

        it("expands a gap smaller than the step fully in one click", () => {
            // Gap 3-4 (2 lines) between block 1 (1-2) and block 2 (5)
            const block1 = mb(1, [mc(" line1", 1, 1), mc("+line2", 2)]);
            const block2 = mb(5, [mc(" line5", 5, 5)]);
            mockParsedFile([block1, block2]);

            const { container } = renderDiffView({
                headSha: "mock-sha",
                owner: "owner",
                repo: "repo",
                pullNumber: 1,
            });

            // Middle gap 3-4 + trailing gap 6-100
            expect(
                container.querySelectorAll(
                    '[data-testid="arrow-down-from-line"]',
                ).length,
            ).toBe(2);

            fireEvent.click(
                container.querySelector(
                    '[data-testid="arrow-down-from-line"]',
                )!,
            );

            const rowIds = Array.from(
                container.querySelectorAll('tr[id^="diff-"]'),
            ).map((tr) => tr.id);
            const nums = rowIds.map((id) => Number(id.split("R")[1]));
            expect(nums).toContain(3);
            expect(nums).toContain(4);
            // Middle gap fully expanded -> only the trailing expand-down
            // button remains
            expect(
                container.querySelectorAll(
                    '[data-testid="arrow-down-from-line"]',
                ).length,
            ).toBe(1);
            expect(
                container.querySelectorAll('[data-testid="arrow-up-from-line"]')
                    .length,
            ).toBe(0);
        });

        it("expands up reveals the lines just below the previous hunk", () => {
            // Block 1 covers lines 1-10, block 2 starts at 91 -> gap 11-90 (80 lines)
            const block1 = mb(
                1,
                Array.from({ length: 10 }, (_, i) =>
                    mc(` line${i + 1}`, i + 1, i + 1),
                ),
            );
            const block2 = mb(91, [mc(" line91", 91, 91)]);
            mockParsedFile([block1, block2]);

            const { container } = renderDiffView({
                headSha: "mock-sha",
                owner: "owner",
                repo: "repo",
                pullNumber: 1,
            });

            // Click the down-arrow button (expands upward): reveals the top
            // of the gap (11-30) above the unfold row, toward the previous
            // hunk.
            fireEvent.click(
                container.querySelector(
                    '[data-testid="arrow-down-from-line"]',
                )!,
            );

            let nums = gapRowNumbers(container);
            expect(nums).toHaveLength(20);
            expect(nums[0]).toBe(11);
            expect(nums[19]).toBe(30);
            expect(nums).not.toContain(71);

            const rows = Array.from(container.querySelectorAll("tr"));
            const firstTopIdx = rows.findIndex((tr) => tr.id?.endsWith("R11"));
            const unfoldRowIdx = rows.findIndex((tr) =>
                tr.querySelector('[data-testid="arrow-up-from-line"]'),
            );
            expect(firstTopIdx).toBeLessThan(unfoldRowIdx);

            // Then expand down via the up-arrow button: 71-90 appear below
            // the unfold row.
            fireEvent.click(
                container.querySelector('[data-testid="arrow-up-from-line"]')!,
            );
            nums = gapRowNumbers(container);
            expect(nums).toHaveLength(40);
            expect(nums[0]).toBe(11);
            expect(nums[19]).toBe(30);
            expect(nums[39]).toBe(90);

            // Both revealed regions flank the unfold row.
            const rows2 = Array.from(container.querySelectorAll("tr"));
            const topEndIdx = rows2.findIndex((tr) => tr.id?.endsWith("R30"));
            const unfoldIdx = rows2.findIndex((tr) =>
                tr.querySelector('[data-testid="arrow-down-from-line"]'),
            );
            const bottomStartIdx = rows2.findIndex((tr) =>
                tr.id?.endsWith("R71"),
            );
            expect(topEndIdx).toBeLessThan(unfoldIdx);
            expect(unfoldIdx).toBeLessThan(bottomStartIdx);
        });

        it("loads the lines before the first hunk when expanding the leading gap", () => {
            // First hunk starts at line 40 -> leading gap 1-39 (39 lines)
            const block1 = mb(40, [mc(" line40", 40, 40), mc("+line41", 41)]);
            mockParsedFile([block1]);

            const { container } = renderDiffView({
                headSha: "mock-sha",
                owner: "owner",
                repo: "repo",
                pullNumber: 1,
            });

            function leadingGapNums() {
                return Array.from(container.querySelectorAll('tr[id^="diff-"]'))
                    .map((tr) => Number(tr.id.split("R")[1]))
                    .filter((n) => n >= 1 && n <= 39);
            }

            // Buttons: leading gap (1-39) shows expand-up; trailing gap
            // (42-100) shows expand-down.
            let upButtons = container.querySelectorAll(
                '[data-testid="arrow-up-from-line"]',
            );
            const downButtons = container.querySelectorAll(
                '[data-testid="arrow-down-from-line"]',
            );
            expect(upButtons.length).toBe(1);
            expect(downButtons.length).toBe(1);
            expect(leadingGapNums()).toHaveLength(0);

            // Click 1: the 20 lines immediately before the hunk (20-39),
            // not the first 20 lines of the file
            fireEvent.click(upButtons[0]!);
            let nums = leadingGapNums();
            expect(nums).toHaveLength(20);
            expect(nums[0]).toBe(20);
            expect(nums[19]).toBe(39);
            expect(nums).not.toContain(1);

            // The unfold row moves to the top: it renders above the first
            // revealed line so the next click loads the lines above it.
            const rows = Array.from(container.querySelectorAll("tr"));
            const unfoldIdx = rows.findIndex((tr) =>
                tr.querySelector('[data-testid="arrow-up-from-line"]'),
            );
            const firstRevealedIdx = rows.findIndex((tr) =>
                tr.id?.endsWith("R20"),
            );
            expect(unfoldIdx).toBeGreaterThanOrEqual(0);
            expect(firstRevealedIdx).toBeGreaterThan(unfoldIdx);

            // Click 2: remaining lines 1-19, unfold row disappears
            upButtons = container.querySelectorAll(
                '[data-testid="arrow-up-from-line"]',
            );
            fireEvent.click(upButtons[0]!);
            nums = leadingGapNums();
            expect(nums).toHaveLength(39);
            expect(nums[0]).toBe(1);
            expect(nums[38]).toBe(39);
            // Only the trailing expand-down button remains
            expect(
                container.querySelectorAll('[data-testid="arrow-up-from-line"]')
                    .length,
            ).toBe(0);
            expect(
                container.querySelectorAll(
                    '[data-testid="arrow-down-from-line"]',
                ).length,
            ).toBe(1);
        });
    });
});

describe("DiffView split view", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseFileContent.lines = null;
        mockUseFileContent.isLoading = false;
        mockUseFileContent.error = null;
    });

    describe("row structure", () => {
        it("renders four columns with per-side line numbers for context lines", () => {
            const lines = [mc(" ctx1", 1, 1), mc(" ctx2", 2, 2)];
            mockParsedFile([mb(1, lines)]);

            const { container } = renderDiffView({ view: "split" });

            expect(container.querySelector(".d2h-split-table")).toBeTruthy();

            const rows = Array.from(
                container.querySelectorAll('tr[id^="diff-"]'),
            );
            expect(rows).toHaveLength(2);

            const cells = rows[0]!.querySelectorAll("td");
            expect(cells).toHaveLength(4);
            // Old number, old content, new number (with divider), new content
            expect(cells[0]!.className).toContain("d2h-split-ln");
            expect(cells[0]!.textContent).toContain("1");
            expect(cells[1]!.className).toContain("d2h-split-code");
            expect(cells[1]!.textContent).toContain("ctx1");
            expect(cells[2]!.className).toContain("d2h-split-new");
            expect(cells[2]!.textContent).toContain("1");
            expect(cells[3]!.textContent).toContain("ctx1");
            // Context rows carry the new-side row id
            expect(rows[0]!.id.endsWith("R1")).toBe(true);
        });

        it("defines line-number column widths via colgroup so unfold rows cannot widen the right column", () => {
            // A leading gap makes the first row an unfold row whose content
            // cell spans 3 columns; in fixed layout that would stretch the
            // right line-number column to content width. The colgroup pins
            // both line-number columns.
            const lines = [mc("+added", 5)];
            mockParsedFile([mb(5, lines)], { addedLines: 1 });

            const { container } = renderDiffView({
                view: "split",
                headSha: "mock-sha",
                owner: "owner",
                repo: "repo",
                pullNumber: 1,
            });

            const table = container.querySelector(".d2h-split-table")!;
            const cols = Array.from(table.querySelectorAll("col"));
            expect(cols).toHaveLength(4);
            expect(cols[0]!.className).toContain("d2h-split-ln-col");
            expect(cols[1]!.className).not.toContain("d2h-split-ln-col");
            expect(cols[2]!.className).toContain("d2h-split-ln-col");
            expect(cols[3]!.className).not.toContain("d2h-split-ln-col");
            // The colgroup sits before the body so fixed layout honors it.
            const colgroup = table.querySelector("colgroup")!;
            expect(colgroup.nextElementSibling?.tagName).toBe("TBODY");
        });

        it("pairs a deleted line with the following added line on one row", () => {
            const lines = [mc("-old2", undefined, 2), mc("+new2", 2)];
            mockParsedFile([mb(1, lines)], {
                addedLines: 1,
                deletedLines: 1,
            });

            const { container } = renderDiffView({ view: "split" });

            const row = container.querySelector('tr[id^="diff-"]')!;
            const cells = row.querySelectorAll("td");
            expect(cells).toHaveLength(4);

            const oldCells = [cells[0]!, cells[1]!];
            for (const cell of oldCells) {
                expect(cell.className).toContain("d2h-del");
            }
            expect(cells[1]!.textContent).toContain("old2");

            const newCells = [cells[2]!, cells[3]!];
            for (const cell of newCells) {
                expect(cell.className).toContain("d2h-ins");
            }
            expect(cells[3]!.textContent).toContain("new2");

            // Row anchors on the new side; the old side gets its own L id
            expect(row.id.endsWith("R2")).toBe(true);
            expect(cells[0]!.id.endsWith("L2")).toBe(true);
        });

        it("renders an empty left side for unpaired additions", () => {
            const lines = [mc("+added", 1)];
            mockParsedFile([mb(1, lines)], { addedLines: 1 });

            const { container } = renderDiffView({ view: "split" });

            const row = container.querySelector('tr[id^="diff-"]')!;
            const cells = row.querySelectorAll("td");
            expect(cells).toHaveLength(4);

            // Old side: empty neutral cells
            expect(cells[0]!.className).toContain("d2h-empty-side");
            expect(cells[1]!.className).toContain("d2h-empty-side");
            expect(cells[1]!.textContent?.trim()).toBe("");
            // New side: number + tinted content
            expect(cells[2]!.className).toContain("d2h-ins");
            expect(cells[2]!.textContent).toContain("1");
            expect(cells[3]!.className).toContain("d2h-ins");
            expect(cells[3]!.textContent).toContain("added");
            expect(row.id.endsWith("R1")).toBe(true);
        });

        it("renders an empty right side for unpaired deletions", () => {
            const lines = [mc("-removed", undefined, 5)];
            mockParsedFile([mb(1, lines)], { deletedLines: 1 });

            const { container } = renderDiffView({ view: "split" });

            const row = container.querySelector('tr[id^="diff-"]')!;
            const cells = row.querySelectorAll("td");
            expect(cells).toHaveLength(4);

            expect(cells[0]!.className).toContain("d2h-del");
            expect(cells[1]!.className).toContain("d2h-del");
            expect(cells[1]!.textContent).toContain("removed");
            expect(cells[2]!.className).toContain("d2h-empty-side");
            expect(cells[3]!.className).toContain("d2h-empty-side");
            expect(cells[3]!.textContent?.trim()).toBe("");
            // No new side: the row anchors on the old line number
            expect(row.id.endsWith("L5")).toBe(true);
        });

        it("pairs deletions with additions by index, leftovers stand alone", () => {
            const lines = [
                mc("-a", undefined, 1),
                mc("-b", undefined, 2),
                mc("+x", 1),
                mc("+y", 2),
                mc("+z", 3),
            ];
            mockParsedFile([mb(1, lines)], {
                addedLines: 3,
                deletedLines: 2,
            });

            const { container } = renderDiffView({ view: "split" });

            const rows = Array.from(
                container.querySelectorAll('tr[id^="diff-"]'),
            );
            expect(rows).toHaveLength(3);

            const cellsOf = (row: Element) => row.querySelectorAll("td");
            expect(cellsOf(rows[0]!)[1]!.textContent).toContain("a");
            expect(cellsOf(rows[0]!)[3]!.textContent).toContain("x");
            expect(cellsOf(rows[1]!)[1]!.textContent).toContain("b");
            expect(cellsOf(rows[1]!)[3]!.textContent).toContain("y");
            // The third addition has no deletion to pair with
            expect(cellsOf(rows[2]!)[1]!.className).toContain("d2h-empty-side");
            expect(cellsOf(rows[2]!)[3]!.textContent).toContain("z");
        });

        it("does not show diff markers (+/-) in split content cells", () => {
            const lines = [mc("+added", 1)];
            mockParsedFile([mb(1, lines)], { addedLines: 1 });

            const { container } = renderDiffView({ view: "split" });
            // The row has two code cells (empty old side + new side); the
            // content lives in the last one.
            const codeLines = container.querySelectorAll(
                ".d2h-split-code-line",
            );
            const code = codeLines[codeLines.length - 1]!;
            expect(code.textContent?.trim()).toBe("added");
            expect(code.textContent).not.toContain("+added");
        });
    });

    describe("comment buttons", () => {
        it("shows a button on each changed side, anchored to its own side", () => {
            const onStartComment = vi.fn();
            const lines = [mc("-old", undefined, 1), mc("+new", 1)];
            mockParsedFile([mb(1, lines)], {
                addedLines: 1,
                deletedLines: 1,
            });

            const { container } = renderDiffView({
                view: "split",
                showCommentButton: true,
                onStartComment,
            });

            const pluses = container.querySelectorAll(
                '[data-testid="square-plus"]',
            );
            expect(pluses).toHaveLength(2);

            // Left button (old side) anchors LEFT
            const leftCell = pluses[0]!.closest("td")!;
            expect(leftCell.className).not.toContain("d2h-split-new");
            fireEvent.click(pluses[0]!);
            expect(onStartComment).toHaveBeenLastCalledWith({
                type: "line",
                line: 1,
                side: "LEFT",
            });

            // Right button (new side) anchors RIGHT
            const rightCell = pluses[1]!.closest("td")!;
            expect(rightCell.className).toContain("d2h-split-new");
            fireEvent.click(pluses[1]!);
            expect(onStartComment).toHaveBeenLastCalledWith({
                type: "line",
                line: 1,
                side: "RIGHT",
            });
        });

        it("offers context-line comments from both sides, anchored to the new side", () => {
            const onStartComment = vi.fn();
            const lines = [mc(" ctx", 1, 1)];
            mockParsedFile([mb(1, lines)]);

            const { container } = renderDiffView({
                view: "split",
                showCommentButton: true,
                onStartComment,
            });

            const pluses = container.querySelectorAll(
                '[data-testid="square-plus"]',
            );
            expect(pluses).toHaveLength(2);

            // One button per side: the old (left) cell and the new (right) cell.
            const leftPlus = Array.from(pluses).find(
                (p) => !p.closest("td")!.className.includes("d2h-split-new"),
            )!;
            const rightPlus = Array.from(pluses).find((p) => p !== leftPlus)!;
            expect(rightPlus.closest("td")!.className).toContain(
                "d2h-split-new",
            );

            // Both buttons anchor the comment to the new side (like unified view).
            fireEvent.click(leftPlus);
            expect(onStartComment).toHaveBeenCalledWith({
                type: "line",
                line: 1,
                side: "RIGHT",
            });
            fireEvent.click(rightPlus);
            expect(onStartComment).toHaveBeenCalledWith({
                type: "line",
                line: 1,
                side: "RIGHT",
            });
        });

        it("shows only the hovered side's button on paired rows", () => {
            const lines = [mc("-old", undefined, 1), mc("+new", 1)];
            mockParsedFile([mb(1, lines)], {
                addedLines: 1,
                deletedLines: 1,
            });

            const { container } = renderDiffView({
                view: "split",
                showCommentButton: true,
            });

            const row = container.querySelector('tr[id^="diff-"]')!;
            const cells = row.querySelectorAll("td");
            const pluses = row.querySelectorAll('[data-testid="square-plus"]');
            const leftPlus = Array.from(pluses).find(
                (p) => !p.closest("td")!.className.includes("d2h-split-new"),
            )!;
            const rightPlus = Array.from(pluses).find((p) => p !== leftPlus)!;
            const leftCode = cells[1]!;
            const rightCode = cells[3]!;

            const isHidden = (el: Element) =>
                el.className.includes("hidden") &&
                !el.className.includes("block");

            // Nothing hovered: both buttons hidden.
            expect(isHidden(leftPlus)).toBe(true);
            expect(isHidden(rightPlus)).toBe(true);

            // Hover the left side: only the left button appears.
            fireEvent.mouseEnter(leftCode);
            expect(leftPlus.className).toContain("block");
            expect(rightPlus.className).toContain("hidden");

            // Hover the right side: only the right button appears.
            fireEvent.mouseEnter(rightCode);
            expect(leftPlus.className).toContain("hidden");
            expect(rightPlus.className).toContain("block");

            // Leaving the row hides the button again.
            fireEvent.mouseLeave(row);
            expect(isHidden(leftPlus)).toBe(true);
            expect(isHidden(rightPlus)).toBe(true);
        });

        it("shows the context button for whichever side is hovered", () => {
            const lines = [mc(" ctx", 1, 1)];
            mockParsedFile([mb(1, lines)]);

            const { container } = renderDiffView({
                view: "split",
                showCommentButton: true,
            });

            const row = container.querySelector('tr[id^="diff-"]')!;
            const cells = row.querySelectorAll("td");
            const pluses = row.querySelectorAll('[data-testid="square-plus"]');
            const leftPlus = Array.from(pluses).find(
                (p) => !p.closest("td")!.className.includes("d2h-split-new"),
            )!;
            const rightPlus = Array.from(pluses).find((p) => p !== leftPlus)!;

            // Hover the left side: only the left button appears.
            fireEvent.mouseEnter(cells[1]!);
            expect(leftPlus.className).toContain("block");
            expect(rightPlus.className).toContain("hidden");

            // Hover the right side: only the right button appears.
            fireEvent.mouseEnter(cells[3]!);
            expect(leftPlus.className).toContain("hidden");
            expect(rightPlus.className).toContain("block");
        });

        it("shows the button for unpaired additions only when the new side is hovered", () => {
            const lines = [mc("+added", 1)];
            mockParsedFile([mb(1, lines)], { addedLines: 1 });

            const { container } = renderDiffView({
                view: "split",
                showCommentButton: true,
            });

            const row = container.querySelector('tr[id^="diff-"]')!;
            const cells = row.querySelectorAll("td");
            const plus = row.querySelector('[data-testid="square-plus"]')!;

            // The empty old side carries no button and no hover action.
            fireEvent.mouseEnter(cells[0]!);
            expect(plus.className).toContain("hidden");

            fireEvent.mouseEnter(cells[3]!);
            expect(plus.className).toContain("block");
        });

        it("opens the comment editor under the row when either side is active", () => {
            const lines = [mc("-old", undefined, 1), mc("+new", 1)];
            mockParsedFile([mb(1, lines)], {
                addedLines: 1,
                deletedLines: 1,
            });

            const { container } = renderDiffView({
                view: "split",
                activeComment: { type: "line", line: 1, side: "LEFT" },
            });

            const editorRow = screen
                .getByTestId("markdown-editor")
                .closest("tr")!;
            expect(editorRow.querySelector("td")!.colSpan).toBe(4);
            void container;
        });
    });

    describe("comments display", () => {
        it("renders inline comment threads spanning all four columns", () => {
            const lines = [mc("+added", 1)];
            mockParsedFile([mb(1, lines)], { addedLines: 1 });

            const comments = makeMockComments([
                { id: 1, line: 1, side: "RIGHT", path: "test.ts" },
            ]);

            renderDiffView({ view: "split", showComments: true, comments });

            const thread = screen.getByTestId("inline-comment-thread");
            const threadRow = thread.closest("tr")!;
            expect(threadRow.querySelector("td")!.colSpan).toBe(4);
            // Anchored below the added line row
            expect(threadRow.previousElementSibling?.id.endsWith("R1")).toBe(
                true,
            );
        });

        it("anchors old-side comments to the deleted side of a paired row", () => {
            const lines = [mc("-old", undefined, 1), mc("+new", 1)];
            mockParsedFile([mb(1, lines)], {
                addedLines: 1,
                deletedLines: 1,
            });

            const comments = makeMockComments([
                { id: 7, line: 1, side: "LEFT", path: "test.ts" },
            ]);

            renderDiffView({ view: "split", showComments: true, comments });

            const thread = screen.getByTestId("inline-comment-thread");
            const threadRow = thread.closest("tr")!;
            expect(threadRow.previousElementSibling?.id.endsWith("R1")).toBe(
                true,
            );
        });
    });

    describe("permalinks", () => {
        beforeEach(() => {
            vi.spyOn(window.history, "replaceState").mockImplementation(
                vi.fn(),
            );
        });

        it("clicking the old line number links the old side", async () => {
            const user = userEvent.setup();
            const lines = [mc(" ctx", 1, 1)];
            mockParsedFile([mb(1, lines)]);

            const { container } = renderDiffView({ view: "split" });
            const oldNumCell = container.querySelector("td.d2h-split-ln")!;
            await user.click(oldNumCell);

            expect(window.history.replaceState).toHaveBeenCalledWith(
                null,
                "",
                expect.stringMatching(new RegExp(`#diff-${FILE_HASH}L1$`)),
            );
        });

        it("clicking the new line number links the new side", async () => {
            const user = userEvent.setup();
            const lines = [mc(" ctx", 1, 1)];
            mockParsedFile([mb(1, lines)]);

            const { container } = renderDiffView({ view: "split" });
            const newNumCell = container.querySelector(
                "td.d2h-split-ln.d2h-split-new",
            )!;
            await user.click(newNumCell);

            expect(window.history.replaceState).toHaveBeenCalledWith(
                null,
                "",
                expect.stringMatching(new RegExp(`#diff-${FILE_HASH}R1$`)),
            );
        });
    });

    describe("gap rows", () => {
        beforeEach(() => {
            mockUseFileContent.lines = ["line1", "line2", "line3", "line4"];
            mockUseFileContent.isLoading = false;
            mockUseFileContent.error = null;
        });

        it("renders expand rows spanning the split columns", () => {
            const lines = [mc("+line2", 2)];
            mockParsedFile([mb(2, lines)], { addedLines: 1 });

            const { container } = renderDiffView({
                view: "split",
                expandAllContext: false,
                headSha: "mock-sha",
                owner: "owner",
                repo: "repo",
                pullNumber: 1,
            });

            const infoCells = Array.from(
                container.querySelectorAll("td.d2h-info"),
            );
            expect(infoCells.length).toBeGreaterThan(0);
            // The content cell of an info row spans the remaining columns
            const infoRow = infoCells[0]!.closest("tr")!;
            const spanned = Array.from(infoRow.querySelectorAll("td")).find(
                (td) => td.colSpan === 3,
            );
            expect(spanned).toBeTruthy();
        });

        it("renders expanded gap context lines on both sides", () => {
            const lines = [mc("+line2", 2)];
            mockParsedFile([mb(2, lines)], { addedLines: 1 });

            const { container } = renderDiffView({
                view: "split",
                expandAllContext: true,
                headSha: "mock-sha",
                owner: "owner",
                repo: "repo",
                pullNumber: 1,
            });

            // Leading gap lines 1 and trailing gap lines 3-4 render as
            // context rows with four cells each.
            const gapRows = Array.from(
                container.querySelectorAll('tr[id^="diff-"]'),
            ).filter((tr) => tr.id.endsWith("R1") || tr.id.endsWith("R3"));
            expect(gapRows).toHaveLength(2);
            for (const row of gapRows) {
                const cells = row.querySelectorAll("td");
                expect(cells).toHaveLength(4);
                expect(cells[1]!.textContent).toContain(
                    cells[3]!.textContent!.trim(),
                );
            }
        });
    });
});
