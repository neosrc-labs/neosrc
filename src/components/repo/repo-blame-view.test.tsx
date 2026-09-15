// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queries = vi.hoisted(() => ({
    blame: vi.fn(),
    contents: vi.fn(),
    fileContent: vi.fn(),
    pathCommits: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace: vi.fn() }),
}));

// Keep the body plain so the assertions never race shiki's grammar load.
vi.mock("~/utils/highlight", () => ({
    highlightLines: async () => null,
}));

vi.mock("~/trpc/react", () => ({
    api: {
        repos: {
            getBlame: { useQuery: queries.blame },
            getContents: { useQuery: queries.contents },
            getFileContent: { useQuery: queries.fileContent },
            getPathCommits: { useQuery: queries.pathCommits },
        },
    },
}));

import { RepoBlameView } from "./repo-blame-view";

const CONTENT = "one\ntwo\nthree\nfour";

/** A file entry, so the view renders a body rather than a not-found page. */
const FILE_ENTRY = {
    type: "file",
    name: "a.txt",
    path: "a.txt",
    sha: "s",
    size: 18,
    htmlUrl: null,
};

function resolveQueries(blame: unknown) {
    queries.contents.mockReturnValue({
        data: [FILE_ENTRY],
        error: null,
        isPlaceholderData: false,
        isPending: false,
        isFetching: false,
    });
    queries.fileContent.mockReturnValue({
        data: { content: CONTENT },
        error: null,
        isPlaceholderData: false,
        isPending: false,
        isFetching: false,
    });
    queries.pathCommits.mockReturnValue({
        data: [],
        isPlaceholderData: false,
    });
    queries.blame.mockReturnValue({ data: blame, isPlaceholderData: false });
}

function renderView() {
    return render(
        <RepoBlameView
            provider="gh"
            owner="o"
            repo="r"
            selectedRef="main"
            path="a.txt"
        />,
    );
}

describe("RepoBlameView", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("groups consecutive lines into one gutter cell per range", () => {
        resolveQueries({
            commits: {
                aaa: {
                    message: "old commit",
                    committedDate: "2020-01-01T00:00:00Z",
                    author: null,
                },
                bbb: {
                    message: "new commit",
                    committedDate: "2026-01-01T00:00:00Z",
                    author: null,
                },
            },
            ranges: [
                { startLine: 1, endLine: 3, age: 10, sha: "aaa" },
                { startLine: 4, endLine: 4, age: 1, sha: "bbb" },
            ],
        });

        renderView();

        // One commit label for a three-line range: the gutter spans the range.
        expect(screen.getByText("old commit")).toBeInTheDocument();
        expect(screen.getAllByText("old commit")).toHaveLength(1);
        expect(screen.getByText("new commit")).toBeInTheDocument();

        // Line numbers are range.startLine..range.endLine.
        for (const line of ["1", "2", "3", "4"]) {
            expect(screen.getByText(line)).toBeInTheDocument();
        }
        // Each range's code column carries its own slice of the source.
        expect(screen.getByText("three")).toBeInTheDocument();
        expect(screen.getByText("four")).toBeInTheDocument();
    });

    it("colours each range bar by its age bucket", () => {
        resolveQueries({
            commits: {
                aaa: {
                    message: "old commit",
                    committedDate: "2020-01-01T00:00:00Z",
                    author: null,
                },
                bbb: {
                    message: "new commit",
                    committedDate: "2026-01-01T00:00:00Z",
                    author: null,
                },
            },
            ranges: [
                { startLine: 1, endLine: 3, age: 10, sha: "aaa" },
                { startLine: 4, endLine: 4, age: 1, sha: "bbb" },
            ],
        });

        const { container } = renderView();

        // The age bar is the only w-1 element; the legend swatches are w-4.
        const bars = container.querySelectorAll<HTMLElement>("div.w-1");
        expect(bars).toHaveLength(2);
        expect(bars[0]?.style.backgroundColor).toBe("var(--color-blame-age-0)");
        expect(bars[1]?.style.backgroundColor).toBe("var(--color-blame-age-9)");
    });

    it("falls back to the file when the provider has no blame", () => {
        resolveQueries(null);

        renderView();

        expect(
            screen.getByText("Blame is not available for this file."),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "View the file" }),
        ).toHaveAttribute("href", "/gh/o/r/blob/main/a.txt");
    });
});
