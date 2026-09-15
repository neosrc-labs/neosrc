import type * as OctokitGraphqlModule from "@octokit/graphql";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGraphql } = vi.hoisted(() => ({ mockGraphql: vi.fn() }));

vi.mock("@octokit/graphql", async (importOriginal) => {
    const actual = await importOriginal<typeof OctokitGraphqlModule>();
    return {
        ...actual,
        graphql: {
            defaults: () => mockGraphql,
        },
    };
});

import {
    buildBranchDetailsQuery,
    getBranchDetails,
    getBranchRefs,
    REF_SCAN_PAGE_SIZE,
} from "~/server/github/branches";

/** `owner/refs` page payload for the scan query. */
function refsPage(
    refs: Array<{ name: string; committedDate: string }>,
    overrides: {
        defaultBranch?: string | null;
        totalCount?: number;
        hasNextPage?: boolean;
        endCursor?: string | null;
    } = {},
) {
    return {
        repository: {
            defaultBranchRef: overrides.defaultBranch
                ? {
                      name: overrides.defaultBranch,
                      target: { committedDate: "2026-09-01T00:00:00Z" },
                  }
                : null,
            refs: {
                totalCount: overrides.totalCount ?? refs.length,
                pageInfo: {
                    hasNextPage: overrides.hasNextPage ?? false,
                    endCursor: overrides.endCursor ?? null,
                },
                nodes: refs.map((ref) => ({
                    name: ref.name,
                    target: { committedDate: ref.committedDate },
                })),
            },
        },
    };
}

beforeEach(() => {
    mockGraphql.mockReset();
});

describe("buildBranchDetailsQuery", () => {
    it("aliases every branch and inlines escaped qualified names", () => {
        const query = buildBranchDetailsQuery(["a", 'b"c']);

        expect(query).toContain('b0: ref(qualifiedName: "refs/heads/a")');
        expect(query).toContain('b1: ref(qualifiedName: "refs/heads/b\\"c")');
    });
});

describe("getBranchRefs", () => {
    it("walks pages, carrying the cursor and passing the direction", async () => {
        mockGraphql
            .mockResolvedValueOnce(
                refsPage(
                    [{ name: "main", committedDate: "2026-09-01T00:00:00Z" }],
                    {
                        defaultBranch: "main",
                        totalCount: 101,
                        hasNextPage: true,
                        endCursor: "cursor-1",
                    },
                ),
            )
            .mockResolvedValueOnce(
                refsPage(
                    [{ name: "old", committedDate: "2024-01-01T00:00:00Z" }],
                    { totalCount: 101 },
                ),
            );

        const result = await getBranchRefs("tok", "acme", "app", {
            query: "turbo",
            direction: "ASC",
            pages: 3,
        });

        expect(mockGraphql).toHaveBeenCalledTimes(2);
        expect(mockGraphql.mock.calls[0]?.[1]).toMatchObject({
            owner: "acme",
            repo: "app",
            first: REF_SCAN_PAGE_SIZE,
            // `query` is reserved by @octokit/graphql, hence the prefixed name.
            nameQuery: "turbo",
            direction: "ASC",
        });
        expect(String(mockGraphql.mock.calls[0]?.[0])).toContain("$nameQuery");
        expect(mockGraphql.mock.calls[0]?.[1]).not.toHaveProperty("after");
        expect(mockGraphql.mock.calls[1]?.[1]).toMatchObject({
            after: "cursor-1",
        });
        expect(String(mockGraphql.mock.calls[1]?.[0])).toContain(
            "$after: String",
        );
        expect(result.refs.map((ref) => ref.name)).toEqual(["main", "old"]);
        expect(result.defaultBranch).toBe("main");
        expect(result.totalCount).toBe(101);
        expect(result.hasNextPage).toBe(false);
    });

    it("stops after the requested number of scans", async () => {
        mockGraphql.mockResolvedValue(
            refsPage(
                [{ name: "main", committedDate: "2026-09-01T00:00:00Z" }],
                {
                    defaultBranch: "main",
                    hasNextPage: true,
                    endCursor: "cursor-1",
                },
            ),
        );

        const result = await getBranchRefs("tok", "acme", "app", {
            query: null,
            direction: "DESC",
            pages: 2,
        });

        expect(mockGraphql).toHaveBeenCalledTimes(2);
        expect(result.hasNextPage).toBe(true);
        expect(result.endCursor).toBe("cursor-1");
    });
});

describe("getBranchDetails", () => {
    it("maps an open PR, check-run and status contexts", async () => {
        mockGraphql.mockResolvedValue({
            repository: {
                b0: {
                    name: "feat/x",
                    target: {
                        oid: "abc123",
                        committedDate: "2026-08-01T00:00:00Z",
                        author: {
                            name: "Alice",
                            avatarUrl: "https://avatars/alice",
                            user: { login: "alice" },
                        },
                        statusCheckRollup: {
                            contexts: {
                                nodes: [
                                    {
                                        __typename: "CheckRun",
                                        name: "build",
                                        status: "completed",
                                        conclusion: null,
                                        detailsUrl: "https://ci/build",
                                        startedAt: "2026-08-01T00:00:00Z",
                                        completedAt: "2026-08-01T00:01:00Z",
                                    },
                                    {
                                        __typename: "StatusContext",
                                        context: "legacy",
                                        state: "success",
                                        description: "ok",
                                        targetUrl: "https://ci/legacy",
                                    },
                                ],
                            },
                        },
                        associatedPullRequests: {
                            nodes: [
                                { number: 3, state: "CLOSED" },
                                { number: 42, state: "OPEN" },
                            ],
                        },
                    },
                },
                b1: {
                    name: "old",
                    target: {
                        oid: "def456",
                        committedDate: "2024-01-01T00:00:00Z",
                        author: null,
                        associatedPullRequests: { nodes: null },
                    },
                },
            },
        });

        const result = await getBranchDetails("tok", "acme", "app", [
            "feat/x",
            "old",
        ]);

        expect(result.map((ref) => ref.name)).toEqual(["feat/x", "old"]);
        expect(result[0]).toMatchObject({
            oid: "abc123",
            committedDate: "2026-08-01T00:00:00Z",
            authorName: "Alice",
            authorLogin: "alice",
            authorAvatarUrl: "https://avatars/alice",
            pullRequestNumber: 42,
        });
        expect(result[0]?.checks).toEqual([
            {
                name: "build",
                state: "COMPLETED",
                description: null,
                url: "https://ci/build",
                startedAt: "2026-08-01T00:00:00Z",
                completedAt: "2026-08-01T00:01:00Z",
            },
            {
                name: "legacy",
                state: "SUCCESS",
                description: "ok",
                url: "https://ci/legacy",
                startedAt: null,
                completedAt: null,
            },
        ]);
        expect(result[1]).toMatchObject({
            authorName: "",
            authorLogin: null,
            pullRequestNumber: null,
            checks: [],
        });
    });

    it("returns nothing without names", async () => {
        await expect(
            getBranchDetails("tok", "acme", "app", []),
        ).resolves.toEqual([]);
        expect(mockGraphql).not.toHaveBeenCalled();
    });
});
