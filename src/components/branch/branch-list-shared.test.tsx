// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
    BranchListResult,
    BranchRow,
} from "~/server/api/routers/branches/types";

let paramsState = new URLSearchParams();
const mockPush = vi.fn((url: string) => {
    const queryStart = url.indexOf("?");
    paramsState =
        queryStart === -1
            ? new URLSearchParams()
            : new URLSearchParams(url.slice(queryStart + 1));
});

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush, replace: vi.fn() }),
    useSearchParams: () => paramsState,
}));

let listData: BranchListResult | undefined;
let repoPermissions = { write: false, admin: false };
const deleteMutate = vi.fn();
const renameMutate = vi.fn();

vi.mock("~/trpc/react", () => ({
    api: {
        useUtils: () => ({
            branches: { list: { invalidate: vi.fn() } },
            repos: {
                getBranches: { invalidate: vi.fn() },
                getRefCounts: { invalidate: vi.fn() },
            },
        }),
        branches: {
            list: {
                useQuery: () => ({ data: listData, isLoading: false }),
            },
            deleteBranch: {
                useMutation: () => ({
                    mutate: deleteMutate,
                    isPending: false,
                    error: null,
                }),
            },
            renameBranch: {
                useMutation: () => ({
                    mutate: renameMutate,
                    isPending: false,
                    error: null,
                }),
            },
        },
        repos: {
            getByOwnerAndRepo: {
                useQuery: () => ({
                    data: {
                        permissions: repoPermissions,
                        defaultBranch: "main",
                    },
                }),
            },
        },
    },
}));

import { ghBranchConfig } from "./branch-list-config";
import { BranchListShared } from "./branch-list-shared";
import { RenameBranchDialog } from "./rename-branch-dialog";

function row(overrides: Partial<BranchRow> = {}): BranchRow {
    return {
        name: "feat/x",
        sha: "abc123",
        updatedAt: "2026-01-01T00:00:00Z",
        author: null,
        isProtected: false,
        pullRequestNumber: null,
        checks: [],
        ...overrides,
    };
}

function context(name: string, state: string) {
    return {
        name,
        state,
        description: null,
        url: null,
        startedAt: null,
        completedAt: null,
    };
}

function listResult(
    overrides: Partial<BranchListResult> = {},
): BranchListResult {
    return {
        items: [],
        totalCount: 0,
        hasNextPage: false,
        defaultBranch: "main",
        defaultBranchRow: null,
        scanLimit: null,
        ...overrides,
    };
}

function renderList() {
    return render(
        <BranchListShared owner="test-owner" repo="test-repo" provider="gh" />,
    );
}

beforeEach(() => {
    paramsState = new URLSearchParams();
    mockPush.mockClear();
    deleteMutate.mockClear();
    renameMutate.mockClear();
    listData = undefined;
    repoPermissions = { write: false, admin: false };
});

describe("BranchListShared", () => {
    it("opens on the overview tab with the default and active sections", () => {
        listData = listResult({
            items: [row({ name: "fresh" })],
            totalCount: 1,
            defaultBranchRow: row({ name: "main" }),
        });

        renderList();

        expect(
            screen.getByRole("button", { name: "Overview" }).className,
        ).toContain("border-blue-500");
        expect(
            screen.getByRole("heading", { name: "Default" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: "Active branches" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "View more branches" }),
        ).toHaveAttribute("href", "?tab=all");
    });

    it("pushes tab=active when the active tab is clicked", async () => {
        const user = userEvent.setup();
        listData = listResult({ items: [] });

        renderList();
        await user.click(screen.getByRole("button", { name: "Active" }));

        expect(mockPush).toHaveBeenCalledWith(
            expect.stringContaining("tab=active"),
        );
    });

    it("renders the branch, its check rollup, pull request and protected shield", () => {
        paramsState = new URLSearchParams("tab=all");
        listData = listResult({
            items: [
                row({
                    name: "feat/x",
                    isProtected: true,
                    pullRequestNumber: 42,
                    checks: [
                        context("build", "SUCCESS"),
                        context("lint", "FAILURE"),
                    ],
                }),
                row({ name: "plain" }),
            ],
            totalCount: 2,
        });

        renderList();

        expect(
            screen.getByRole("link", { name: "feat/x" }),
        ).toBeInTheDocument();
        expect(screen.getByText("1 / 2")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "#42" })).toHaveAttribute(
            "href",
            "/gh/test-owner/test-repo/pull/42",
        );
        expect(screen.getAllByLabelText("Protected branch")).toHaveLength(1);
        expect(screen.getAllByText("—")).toHaveLength(1);
    });

    it("notes the partial ref scan behind the date tabs", () => {
        paramsState = new URLSearchParams("tab=active");
        listData = listResult({
            items: [row({ name: "feat/x" })],
            totalCount: 1,
            scanLimit: { scanned: 600, total: 2593 },
        });

        renderList();

        expect(
            screen.getByText(
                "Active and Stale are computed from 600 of 2593 branches. All lists every branch.",
            ),
        ).toBeInTheDocument();
    });

    it("opens the delete dialog for a manageable branch", async () => {
        const user = userEvent.setup();
        paramsState = new URLSearchParams("tab=all");
        repoPermissions = { write: true, admin: false };
        listData = listResult({
            items: [row({ name: "feat/x" }), row({ name: "main" })],
            totalCount: 2,
            defaultBranchRow: null,
        });
        listData.defaultBranch = "main";

        renderList();
        await user.click(
            screen.getByRole("button", { name: "Delete branch feat/x" }),
        );

        expect(screen.getByText("Delete branch 'feat/x'?")).toBeInTheDocument();
        // The default branch has no delete control at all.
        expect(
            screen.queryByRole("button", { name: "Delete branch main" }),
        ).toBeNull();

        await user.click(screen.getByRole("button", { name: "Delete branch" }));
        expect(deleteMutate).toHaveBeenCalledWith({
            provider: "gh",
            owner: "test-owner",
            repo: "test-repo",
            branch: "feat/x",
        });
    });

    it("hides the delete control without write permission", () => {
        paramsState = new URLSearchParams("tab=all");
        listData = listResult({
            items: [row({ name: "feat/x" })],
            totalCount: 1,
        });

        const { unmount } = renderList();
        expect(
            screen.queryByRole("button", { name: "Delete branch feat/x" }),
        ).toBeNull();
        unmount();

        repoPermissions = { write: true, admin: false };
        renderList();
        expect(
            screen.getByRole("button", { name: "Delete branch feat/x" }),
        ).toBeInTheDocument();
    });
});

describe("RenameBranchDialog", () => {
    it("seeds the current name and submits the new one", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();

        render(
            <RenameBranchDialog
                owner="test-owner"
                repo="test-repo"
                branch="feat/x"
                config={ghBranchConfig}
                onClose={onClose}
            />,
        );

        const input = screen.getByLabelText("New branch name");
        expect(input).toHaveValue("feat/x");

        await user.clear(input);
        await user.type(input, "feat/y");
        await user.click(screen.getByRole("button", { name: "Rename branch" }));

        expect(renameMutate).toHaveBeenCalledWith({
            provider: "gh",
            owner: "test-owner",
            repo: "test-repo",
            branch: "feat/x",
            newName: "feat/y",
        });
    });
});
