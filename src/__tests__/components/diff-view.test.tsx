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
            onMouseDown={props.onMouseDown as React.MouseEventHandler}
            onClick={props.onClick as React.MouseEventHandler}
        />
    ),
    UnfoldVertical: () => <div data-testid="unfold-icon" />,
    FoldVertical: () => <div data-testid="fold-icon" />,
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

        it("renders expandable gap row between hunks with unfold icon", () => {
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

            // Gap between blocks: line 3-4
            const unfoldIcons = container.querySelectorAll(
                '[data-testid="unfold-icon"]',
            );
            // There should be the unfold icon in the gap row between blocks
            expect(unfoldIcons.length).toBeGreaterThanOrEqual(1);
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

        it("expandAllContext true expands all gaps (no unfold icons)", () => {
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

            const unfoldIcons = container.querySelectorAll(
                '[data-testid="unfold-icon"]',
            );
            expect(unfoldIcons.length).toBe(0);
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

            // Only trailing gap may render an unfold icon (no between-block gap)
            const unfoldIcons = container.querySelectorAll(
                '[data-testid="unfold-icon"]',
            );
            // Adjacent blocks = no between-block gap = at most 1 trailing icon
            expect(unfoldIcons.length).toBeLessThanOrEqual(1);
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

            // Icons: middle gap (11-90) + trailing gap (92-100)
            let icons = container.querySelectorAll(
                '[data-testid="unfold-icon"]',
            );
            expect(icons.length).toBe(2);
            expect(gapRowNumbers(container)).toHaveLength(0);

            // Click 1: lines 11-30, unfold row remains
            fireEvent.click(icons[0]!.closest("tr")!);
            let nums = gapRowNumbers(container);
            expect(nums).toHaveLength(20);
            expect(nums[0]).toBe(11);
            expect(nums[19]).toBe(30);
            expect(
                container.querySelectorAll('[data-testid="unfold-icon"]')
                    .length,
            ).toBe(2);

            // Middle gap reveals forward: the unfold row sits below the
            // revealed lines (just above the next hunk).
            const rows = Array.from(container.querySelectorAll("tr"));
            const lastRevealedIdx = rows.findIndex((tr) =>
                tr.id?.endsWith("R30"),
            );
            const unfoldIdx = rows.findIndex((tr) =>
                tr.querySelector('[data-testid="unfold-icon"]'),
            );
            expect(unfoldIdx).toBeGreaterThan(lastRevealedIdx);

            // Click 2: lines 11-50
            icons = container.querySelectorAll('[data-testid="unfold-icon"]');
            fireEvent.click(icons[0]!.closest("tr")!);
            nums = gapRowNumbers(container);
            expect(nums).toHaveLength(40);
            expect(nums[39]).toBe(50);

            // Click 3: lines 11-70
            icons = container.querySelectorAll('[data-testid="unfold-icon"]');
            fireEvent.click(icons[0]!.closest("tr")!);
            nums = gapRowNumbers(container);
            expect(nums).toHaveLength(60);
            expect(nums[59]).toBe(70);

            // Click 4: gap exhausted, middle unfold row disappears
            icons = container.querySelectorAll('[data-testid="unfold-icon"]');
            fireEvent.click(icons[0]!.closest("tr")!);
            nums = gapRowNumbers(container);
            expect(nums).toHaveLength(80);
            expect(nums[0]).toBe(11);
            expect(nums[79]).toBe(90);
            // Only the trailing gap still offers an unfold row
            expect(
                container.querySelectorAll('[data-testid="unfold-icon"]')
                    .length,
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

            const icons = container.querySelectorAll(
                '[data-testid="unfold-icon"]',
            );
            // Middle gap 3-4 + trailing gap 6-100
            expect(icons.length).toBe(2);

            fireEvent.click(icons[0]!.closest("tr")!);

            const rowIds = Array.from(
                container.querySelectorAll('tr[id^="diff-"]'),
            ).map((tr) => tr.id);
            const nums = rowIds.map((id) => Number(id.split("R")[1]));
            expect(nums).toContain(3);
            expect(nums).toContain(4);
            // Middle gap fully expanded -> only the trailing unfold row remains
            expect(
                container.querySelectorAll('[data-testid="unfold-icon"]')
                    .length,
            ).toBe(1);
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

            // Icons: leading gap (1-39) + trailing gap (42-100)
            let icons = container.querySelectorAll(
                '[data-testid="unfold-icon"]',
            );
            expect(icons.length).toBe(2);
            expect(leadingGapNums()).toHaveLength(0);

            // Click 1: the 20 lines immediately before the hunk (20-39),
            // not the first 20 lines of the file
            fireEvent.click(icons[0]!.closest("tr")!);
            let nums = leadingGapNums();
            expect(nums).toHaveLength(20);
            expect(nums[0]).toBe(20);
            expect(nums[19]).toBe(39);
            expect(nums).not.toContain(1);

            // The unfold row moves to the top: it renders above the first
            // revealed line so the next click loads the lines above it.
            const rows = Array.from(container.querySelectorAll("tr"));
            const unfoldIdx = rows.findIndex((tr) =>
                tr.querySelector('[data-testid="unfold-icon"]'),
            );
            const firstRevealedIdx = rows.findIndex((tr) =>
                tr.id?.endsWith("R20"),
            );
            expect(unfoldIdx).toBeGreaterThanOrEqual(0);
            expect(firstRevealedIdx).toBeGreaterThan(unfoldIdx);

            // Click 2: remaining lines 1-19, unfold row disappears
            icons = container.querySelectorAll('[data-testid="unfold-icon"]');
            fireEvent.click(icons[0]!.closest("tr")!);
            nums = leadingGapNums();
            expect(nums).toHaveLength(39);
            expect(nums[0]).toBe(1);
            expect(nums[38]).toBe(39);
            // Only the trailing unfold row remains
            expect(
                container.querySelectorAll('[data-testid="unfold-icon"]')
                    .length,
            ).toBe(1);
        });
    });
});
