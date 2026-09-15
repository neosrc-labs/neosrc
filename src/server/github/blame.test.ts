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

// Stub the db module so importing the cache does not require env.
vi.mock("~/server/db", () => ({ db: {} }));

import { getFileBlame } from "~/server/github/blame";

function commitNode(overrides: Record<string, unknown> = {}) {
    return {
        oid: "aaa",
        messageHeadline: "old commit",
        committedDate: "2020-01-01T00:00:00Z",
        authors: {
            nodes: [
                {
                    name: "Old Dev",
                    email: "old@example.com",
                    avatarUrl: "https://avatars.example/1",
                    user: {
                        __typename: "User",
                        login: "olddev",
                        avatarUrl: "https://avatars.example/1",
                        url: "https://github.com/olddev",
                    },
                },
            ],
        },
        ...overrides,
    };
}

describe("getFileBlame", () => {
    beforeEach(() => {
        mockGraphql.mockReset();
    });

    it("queries the ref as the object expression", async () => {
        mockGraphql.mockResolvedValue({
            repository: { object: { blame: { ranges: [] } } },
        });

        await getFileBlame("token", "o", "r", "release-1", "src/a.ts");

        const [, variables] = mockGraphql.mock.calls[0] ?? [];
        expect(variables).toMatchObject({
            owner: "o",
            repo: "r",
            expression: "release-1",
            path: "src/a.ts",
        });
    });

    it("builds one commit per oid and maps ranges through unchanged", async () => {
        mockGraphql.mockResolvedValue({
            repository: {
                object: {
                    blame: {
                        ranges: [
                            {
                                startingLine: 1,
                                endingLine: 3,
                                age: 10,
                                commit: commitNode(),
                            },
                            {
                                startingLine: 4,
                                endingLine: 4,
                                age: 1,
                                commit: commitNode(),
                            },
                        ],
                    },
                },
            },
        });

        const blame = await getFileBlame("token", "o", "r", "main", "a.ts");

        expect(blame).not.toBeNull();
        expect(Object.keys(blame?.commits ?? {})).toEqual(["aaa"]);
        expect(blame?.commits.aaa).toEqual({
            message: "old commit",
            committedDate: "2020-01-01T00:00:00Z",
            author: {
                login: "olddev",
                name: "Old Dev",
                avatarUrl: "https://avatars.example/1",
                url: "https://github.com/olddev",
            },
        });
        expect(blame?.ranges).toEqual([
            { startLine: 1, endLine: 3, age: 10, sha: "aaa" },
            { startLine: 4, endLine: 4, age: 1, sha: "aaa" },
        ]);
    });

    it("resolves the author from a noreply email when the user node is null", async () => {
        mockGraphql.mockResolvedValue({
            repository: {
                object: {
                    blame: {
                        ranges: [
                            {
                                startingLine: 1,
                                endingLine: 1,
                                age: 5,
                                commit: commitNode({
                                    authors: {
                                        nodes: [
                                            {
                                                name: "Noreply Dev",
                                                email: "42+noreplydev@users.noreply.github.com",
                                                avatarUrl: null,
                                                user: null,
                                            },
                                        ],
                                    },
                                }),
                            },
                        ],
                    },
                },
            },
        });

        const blame = await getFileBlame("token", "o", "r", "main", "a.ts");

        expect(blame?.commits.aaa?.author?.login).toBe("noreplydev");
        expect(blame?.commits.aaa?.author?.url).toBe(
            "https://github.com/noreplydev",
        );
    });

    it("returns null when the ref is not a commit", async () => {
        mockGraphql.mockResolvedValue({ repository: { object: null } });

        await expect(
            getFileBlame("token", "o", "r", "main", "a.ts"),
        ).resolves.toBeNull();
    });

    it("returns null when the object has no blame", async () => {
        mockGraphql.mockResolvedValue({ repository: { object: {} } });

        await expect(
            getFileBlame("token", "o", "r", "main", "a.ts"),
        ).resolves.toBeNull();
    });
});
