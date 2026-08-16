// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installLocalStorage } from "~/__tests__/helpers/local-storage";

import type { PullRequestFile, PullsGetResponseData } from "~/server/github";
import { FilesSection } from "./files-client";

const mockUseFiles = vi.hoisted(() => vi.fn());
vi.mock("~/hooks/files", () => ({
    useFiles: mockUseFiles,
}));

const mockHeadShaQuery = vi.hoisted(() => vi.fn());
const mockCommentsQuery = vi.hoisted(() => vi.fn());
const mockPendingReviewQuery = vi.hoisted(() => vi.fn());
vi.mock("~/trpc/react", () => ({
    api: {
        pulls: {
            headSha: { useQuery: mockHeadShaQuery },
        },
        reviewComments: {
            list: { useQuery: mockCommentsQuery },
        },
        reviews: {
            getPending: { useQuery: mockPendingReviewQuery },
        },
    },
}));

vi.mock("~/components/file-diff", () => ({
    default: ({
        file,
        diffView,
    }: {
        file: { filename: string };
        diffView?: string;
    }) => (
        <div data-testid="file-diff" data-view={diffView ?? "unified"}>
            {file.filename}
        </div>
    ),
}));

vi.mock("./action-section/actions-section", () => ({
    ActionSection: () => null,
}));

function file(filename: string): PullRequestFile {
    return {
        filename,
        status: "modified",
        additions: 1,
        deletions: 0,
    } as PullRequestFile;
}

function makePullRequest(): PullsGetResponseData {
    return {
        base: { sha: "base-sha" },
        head: { sha: "head-sha" },
    } as unknown as PullsGetResponseData;
}

function resolvedPromise<T>(value: T): Promise<T> {
    const promise = Promise.resolve(value);
    const tracked = promise as Promise<T> & {
        status: "fulfilled";
        value: T;
    };
    tracked.status = "fulfilled";
    tracked.value = value;
    return promise;
}

function renderFiles(
    files: PullRequestFile[],
    hash?: string,
    children?: ReactNode,
) {
    if (hash !== undefined) {
        window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${hash}`,
        );
    }
    mockUseFiles.mockReturnValue({ files, isLoading: false });
    mockHeadShaQuery.mockReturnValue({ data: undefined });
    mockCommentsQuery.mockReturnValue({ data: [] });
    mockPendingReviewQuery.mockReturnValue({ data: null });
    return render(
        <FilesSection
            owner="owner"
            repo="repo"
            number={1}
            pullRequestPromise={resolvedPromise(makePullRequest())}
            permissionContextPromise={resolvedPromise({
                currentUser: "testuser",
                isPullRequestAuthor: false,
                repoPermission: "write" as const,
                isPullRequestLocked: false,
            })}
        >
            {children}
        </FilesSection>,
    );
}

describe("FilesSection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.history.replaceState(null, "", window.location.pathname);
    });

    it("renders children below the PR info header and above the files", async () => {
        const { container } = renderFiles(
            [file("src/foo.ts")],
            undefined,
            <div data-testid="commit-card" />,
        );
        await screen.findAllByTestId("file-diff");

        const header = container.querySelector(".sticky");
        const commitCard = screen.getByTestId("commit-card");
        const fileDiff = screen.getAllByTestId("file-diff")[0]!;

        expect(header).not.toBeNull();
        expect(
            header!.compareDocumentPosition(commitCard) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).not.toBe(0);
        expect(
            commitCard.compareDocumentPosition(fileDiff) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).not.toBe(0);
    });

    it("renders each file wrapper with the id used by the file tree anchors", async () => {
        renderFiles([file("src/foo.ts"), file("src/bar/baz.ts")]);
        await screen.findAllByTestId("file-diff");

        const fooWrapper = document.getElementById("src-foo.ts");
        const bazWrapper = document.getElementById("src-bar-baz.ts");
        expect(fooWrapper).not.toBeNull();
        expect(bazWrapper).not.toBeNull();
        expect(fooWrapper?.className).toContain("scroll-mt-18");
    });

    it("scrolls to the file when the hash matches a loaded file", async () => {
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;

        renderFiles([file("src/foo.ts")], "#src-foo.ts");
        await screen.findByTestId("file-diff");

        expect(scrollIntoView).toHaveBeenCalledWith({
            behavior: "smooth",
            block: "start",
        });
    });

    it("does not scroll for review thread hashes", async () => {
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;

        renderFiles([file("src/foo.ts")], "#review-thread-123");
        await screen.findByTestId("file-diff");

        expect(scrollIntoView).not.toHaveBeenCalled();
    });

    describe("diff view toggle", () => {
        let storage: Storage;

        beforeEach(() => {
            storage = installLocalStorage();
        });

        it("renders Unified and Split controls with unified active by default", async () => {
            renderFiles([file("src/foo.ts")]);
            await screen.findByTestId("file-diff");

            const unified = screen.getByRole("button", { name: "Unified" });
            const split = screen.getByRole("button", { name: "Split" });
            expect(unified).toHaveAttribute("aria-pressed", "true");
            expect(split).toHaveAttribute("aria-pressed", "false");
            expect(screen.getByTestId("file-diff")).toHaveAttribute(
                "data-view",
                "unified",
            );
        });

        it("switches every file to split and persists the choice", async () => {
            renderFiles([file("src/foo.ts"), file("src/bar.ts")]);
            await screen.findAllByTestId("file-diff");

            fireEvent.click(screen.getByRole("button", { name: "Split" }));

            const diffs = screen.getAllByTestId("file-diff");
            for (const diff of diffs) {
                expect(diff).toHaveAttribute("data-view", "split");
            }
            expect(
                screen.getByRole("button", { name: "Split" }),
            ).toHaveAttribute("aria-pressed", "true");
            expect(
                screen.getByRole("button", { name: "Unified" }),
            ).toHaveAttribute("aria-pressed", "false");
            expect(storage.getItem("diff-view:owner:repo")).toBe("split");
        });

        it("restores a stored split preference on first render", async () => {
            storage.setItem("diff-view:owner:repo", "split");
            renderFiles([file("src/foo.ts")]);
            await screen.findByTestId("file-diff");

            expect(screen.getByTestId("file-diff")).toHaveAttribute(
                "data-view",
                "split",
            );
            expect(
                screen.getByRole("button", { name: "Split" }),
            ).toHaveAttribute("aria-pressed", "true");
        });

        it("switches back to unified on demand", async () => {
            storage.setItem("diff-view:owner:repo", "split");
            renderFiles([file("src/foo.ts")]);
            await screen.findByTestId("file-diff");

            fireEvent.click(screen.getByRole("button", { name: "Unified" }));

            expect(screen.getByTestId("file-diff")).toHaveAttribute(
                "data-view",
                "unified",
            );
            expect(storage.getItem("diff-view:owner:repo")).toBe("unified");
        });
    });
});
