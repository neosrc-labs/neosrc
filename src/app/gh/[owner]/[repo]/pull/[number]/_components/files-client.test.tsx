// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    default: ({ file }: { file: { filename: string } }) => (
        <div data-testid="file-diff">{file.filename}</div>
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

function renderFiles(files: PullRequestFile[], hash?: string) {
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
        />,
    );
}

describe("FilesSection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.history.replaceState(null, "", window.location.pathname);
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
});
