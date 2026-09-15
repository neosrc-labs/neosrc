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
                    mutate: vi.fn(),
                    isPending: false,
                    error: null,
                }),
            },
            renameBranch: {
                useMutation: () => ({
                    mutate: vi.fn(),
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

function renderList() {
    return render(
        <BranchListShared
            owner="test-owner"
            repo="test-repo"
            config={ghBranchConfig}
        />,
    );
}

beforeEach(() => {
    paramsState = new URLSearchParams();
    mockPush.mockClear();
    listData = undefined;
    repoPermissions = { write: false, admin: false };
});

describe("BranchListShared", () => {
    it("opens on the overview tab with the default and active sections", () => {
        listData = {
            items: [row({ name: "fresh" })],
            totalCount: 1,
            hasNextPage: false,
            defaultBranch: "main",
            defaultBranchRow: row({ name: "main" }),
        };

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
        listData = {
            items: [],
            totalCount: 0,
            hasNextPage: false,
            defaultBranch: "main",
            defaultBranchRow: null,
        };

        renderList();
        await user.click(screen.getByRole("button", { name: "Active" }));

        expect(mockPush).toHaveBeenCalledWith(
            expect.stringContaining("tab=active"),
        );
    });

    it("renders the branch, its check rollup, pull request and protected shield", () => {
        paramsState = new URLSearchParams("tab=all");
        listData = {
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
            hasNextPage: false,
            defaultBranch: "main",
            defaultBranchRow: null,
        };

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

    it("hides the delete control without write permission", () => {
        paramsState = new URLSearchParams("tab=all");
        listData = {
            items: [row({ name: "feat/x" })],
            totalCount: 1,
            hasNextPage: false,
            defaultBranch: "main",
            defaultBranchRow: null,
        };

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
