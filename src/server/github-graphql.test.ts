import type * as OctokitGraphqlModule from "@octokit/graphql";
import { GraphqlResponseError } from "@octokit/graphql";
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
    addReaction,
    getPullRequestReactionsGraphQL,
    isOrgRestrictionError,
    resolveCommitAuthor,
} from "~/server/github-graphql";

describe("getPullRequestReactionsGraphQL", () => {
    beforeEach(() => {
        mockGraphql.mockReset();
    });

    it("aggregates per-content totals from reaction group reactors", async () => {
        mockGraphql.mockResolvedValue({
            repository: {
                pullRequest: {
                    reactions: {
                        nodes: [
                            {
                                databaseId: 1,
                                id: "node-1",
                                content: "THUMBS_UP",
                                createdAt: "2026-01-01T00:00:00Z",
                                user: { login: "alice" },
                            },
                        ],
                    },
                    reactionGroups: [
                        { content: "THUMBS_UP", reactors: { totalCount: 3 } },
                        { content: "HEART", reactors: { totalCount: 2 } },
                    ],
                },
            },
        });

        const result = await getPullRequestReactionsGraphQL(
            "token",
            "owner",
            "repo",
            1,
        );

        expect(result.reactions).toEqual([
            {
                id: 1,
                node_id: "node-1",
                content: "+1",
                created_at: "2026-01-01T00:00:00Z",
                user: { login: "alice" },
            },
        ]);
        expect(result.counts).toEqual({
            total_count: 5,
            "+1": 3,
            "-1": 0,
            laugh: 0,
            confused: 0,
            heart: 2,
            hooray: 0,
            rocket: 0,
            eyes: 0,
        });
    });
});

describe("addReaction", () => {
    beforeEach(() => {
        mockGraphql.mockReset();
    });

    it("translates REST-style content to GraphQL ReactionContent enums", async () => {
        mockGraphql.mockResolvedValue({
            addReaction: {
                reaction: {
                    id: "node-1",
                    content: "THUMBS_UP",
                    user: { login: "alice" },
                },
            },
        });

        await addReaction("token", "subject-1", "+1");

        const variables = mockGraphql.mock.calls[0]?.[1];
        expect(variables?.content).toBe("THUMBS_UP");
    });

    it("maps every REST-style reaction content the router accepts", async () => {
        const restToGraphql: Record<string, string> = {
            "+1": "THUMBS_UP",
            "-1": "THUMBS_DOWN",
            laugh: "LAUGH",
            confused: "CONFUSED",
            heart: "HEART",
            hooray: "HOORAY",
            rocket: "ROCKET",
            eyes: "EYES",
        };

        for (const [rest, graphql] of Object.entries(restToGraphql)) {
            mockGraphql.mockReset();
            mockGraphql.mockResolvedValue({
                addReaction: { reaction: null },
            });

            await addReaction("token", "subject-1", rest);

            const variables = mockGraphql.mock.calls[0]?.[1];
            expect(variables?.content).toBe(graphql);
        }
    });
});

describe("isOrgRestrictionError", () => {
    it("detects OAuth App access restriction errors", () => {
        const error = new GraphqlResponseError(
            {
                query: "query CommitChecks($owner: String!, $repo: String!, $expression: String!) { repository(owner: $owner, name: $repo) { object(expression: $expression) { ... on Commit { statusCheckRollup { contexts(first: 100) { nodes { __typename } } } } } } }",
                variables: {
                    owner: "rust-lang",
                    repo: "rust",
                    expression: "042faa5ce6dbe3509222087ce38e3708e0b2cbc1",
                },
                method: "POST",
                url: "https://api.github.com/graphql",
            },
            {},
            {
                data: { repository: null },
                errors: [
                    {
                        type: "FORBIDDEN",
                        message:
                            "Although you appear to have the correct authorization credentials, the `rust-lang` organization has enabled OAuth App access restrictions, meaning that data access to third-parties is limited.",
                        path: ["repository"],
                        extensions: { code: "FORBIDDEN" },
                        locations: [{ line: 1, column: 1 }],
                    },
                ],
            },
        );

        expect(isOrgRestrictionError(error)).toBe(true);
    });

    it("rejects other graphql errors", () => {
        const error = new GraphqlResponseError(
            {
                query: "query { viewer { login } }",
                variables: {},
                method: "POST",
                url: "https://api.github.com/graphql",
            },
            {},
            {
                data: { viewer: null },
                errors: [
                    {
                        type: "NOT_FOUND",
                        message: "Could not resolve to a node",
                        path: ["viewer"],
                        extensions: { code: "NOT_FOUND" },
                        locations: [{ line: 1, column: 1 }],
                    },
                ],
            },
        );

        expect(isOrgRestrictionError(error)).toBe(false);
    });

    it("returns false for non-graphql errors", () => {
        expect(isOrgRestrictionError(new Error("boom"))).toBe(false);
    });
});

describe("resolveCommitAuthor", () => {
    it("resolves a noreply email to the encoded GitHub account", () => {
        const resolved = resolveCommitAuthor({
            name: "Aiden Park",
            email: "275402320+vip892766gma@users.noreply.github.com",
            avatarUrl: "https://camo.githubusercontent.com/placeholder",
            user: null,
        });

        expect(resolved.user).toEqual({
            __typename: "User",
            login: "vip892766gma",
            avatarUrl: "https://avatars.githubusercontent.com/u/275402320?v=4",
            url: "https://github.com/vip892766gma",
        });
        // Avatar points at the account, not the GitActor gravatar fallback.
        expect(resolved.avatarUrl).toBe(
            "https://avatars.githubusercontent.com/u/275402320?v=4",
        );
    });

    it("leaves an already-resolved author untouched", () => {
        const author = {
            name: "Someone",
            email: "someone@example.com",
            avatarUrl: "https://example.com/avatar.png",
            user: {
                __typename: "User" as const,
                login: "someone",
                avatarUrl: "https://example.com/avatar.png",
                url: "https://github.com/someone",
            },
        };

        expect(resolveCommitAuthor(author)).toBe(author);
    });

    it("keeps authors with a non-noreply email unresolved", () => {
        const resolved = resolveCommitAuthor({
            name: "Jane",
            email: "jane@example.com",
            avatarUrl: null,
            user: null,
        });

        expect(resolved.user).toBeNull();
        expect(resolved.avatarUrl).toBeNull();
    });

    it("keeps authors without an email unresolved", () => {
        const resolved = resolveCommitAuthor({
            name: "No Email",
            email: null,
            avatarUrl: null,
            user: null,
        });

        expect(resolved.user).toBeNull();
    });
});
