import { describe, expect, it } from "vitest";
import {
    mapCbAuthor,
    mapCbLabel,
    mapCbReaction,
    mapCbReactionCounts,
    mapCodebergIssueDetail,
    mapGitHubIssueDetail,
    mapGqlAssignee,
    mapGqlAuthor,
    mapGqlLabel,
    mapPullRequestMetadata,
    mapRestAssignee,
    nullSafe,
} from "~/server/api/routers/mappers";
import type { CodebergIssue, CodebergReaction } from "~/server/codeberg";
import type {
    IssueGetResponseData,
    PullsGetResponseData,
} from "~/server/github";

describe("mapGqlAssignee", () => {
    it("maps login and avatarUrl to camelCase fields", () => {
        const result = mapGqlAssignee({
            login: "alice",
            avatarUrl: "https://avatars/1",
        });
        expect(result).toEqual({
            login: "alice",
            avatarUrl: "https://avatars/1",
        });
    });

    it("does not surface extra fields from the source object", () => {
        // Cast: the public type forbids extras, but the mapper must still
        // ignore unknown keys if a wider object is passed at runtime.
        const result = mapGqlAssignee(
            Object.assign(
                { login: "bob", avatarUrl: "https://avatars/2" } as {
                    login: string;
                    avatarUrl: string;
                },
                { databaseId: 42, url: "https://github.com/bob" },
            ),
        );
        expect(result).toEqual({
            login: "bob",
            avatarUrl: "https://avatars/2",
        });
        expect(Object.keys(result).sort()).toEqual(["avatarUrl", "login"]);
    });

    it("preserves empty string values without coercion", () => {
        const result = mapGqlAssignee({ login: "", avatarUrl: "" });
        expect(result).toEqual({ login: "", avatarUrl: "" });
    });
});

describe("mapGqlLabel", () => {
    it("maps all four label fields", () => {
        const result = mapGqlLabel({
            id: "L_1",
            name: "bug",
            color: "ff0000",
            description: "things are on fire",
        });
        expect(result).toEqual({
            id: "L_1",
            name: "bug",
            color: "ff0000",
            description: "things are on fire",
        });
    });

    it("preserves a null description", () => {
        const result = mapGqlLabel({
            id: "L_2",
            name: "enhancement",
            color: "00ff00",
            description: null,
        });
        expect(result.description).toBeNull();
    });
});

describe("mapGqlAuthor", () => {
    it("returns null when input is null", () => {
        expect(mapGqlAuthor(null)).toBeNull();
    });

    it("maps login, avatarUrl, and url", () => {
        const result = mapGqlAuthor({
            login: "carol",
            avatarUrl: "https://avatars/3",
            url: "https://github.com/carol",
        });
        expect(result).toEqual({
            login: "carol",
            avatarUrl: "https://avatars/3",
            url: "https://github.com/carol",
        });
    });
});

describe("mapRestAssignee", () => {
    it("renames the snake_case avatar_url to camelCase avatarUrl", () => {
        const result = mapRestAssignee({
            login: "dave",
            avatar_url: "https://codeberg/avatars/dave",
        });
        expect(result).toEqual({
            login: "dave",
            avatarUrl: "https://codeberg/avatars/dave",
        });
    });

    it("does not include the source's avatar_url key", () => {
        const result = mapRestAssignee({ login: "eve", avatar_url: "x" });
        expect(Object.keys(result).sort()).toEqual(["avatarUrl", "login"]);
    });
});

describe("mapCbLabel", () => {
    it("converts the numeric id to a string", () => {
        const result = mapCbLabel({
            id: 12345,
            name: "docs",
            color: "0000ff",
            description: "doc-only changes",
        });
        expect(result).toEqual({
            id: "12345",
            name: "docs",
            color: "0000ff",
            description: "doc-only changes",
        });
        expect(typeof result.id).toBe("string");
    });

    it("preserves a null description", () => {
        const result = mapCbLabel({
            id: 0,
            name: "wip",
            color: "ffff00",
            description: null,
        });
        expect(result.id).toBe("0");
        expect(result.description).toBeNull();
    });
});

describe("mapCbAuthor", () => {
    it("returns null when input is null", () => {
        expect(mapCbAuthor(null)).toBeNull();
    });

    it("renames avatar_url to avatarUrl and uses an empty url string", () => {
        const result = mapCbAuthor({
            login: "frank",
            avatar_url: "https://codeberg/avatars/frank",
        });
        expect(result).toEqual({
            login: "frank",
            avatarUrl: "https://codeberg/avatars/frank",
            url: "",
        });
    });
});

describe("nullSafe", () => {
    it("returns [] for null", () => {
        expect(nullSafe(null)).toEqual([]);
    });

    it("returns [] for undefined", () => {
        expect(nullSafe(undefined)).toEqual([]);
    });

    it("returns the original array reference when given a populated array", () => {
        const input = [1, 2, 3];
        const result = nullSafe(input);
        expect(result).toEqual([1, 2, 3]);
        expect(result).toBe(input);
    });

    it("returns an empty array when given an empty array", () => {
        const result = nullSafe([]);
        expect(result).toEqual([]);
    });

    it("preserves element order and identity in an array of objects", () => {
        const a = { id: "a" };
        const b = { id: "b" };
        const result = nullSafe([a, b]);
        expect(result).toEqual([a, b]);
        expect(result[0]).toBe(a);
        expect(result[1]).toBe(b);
    });
});

function githubIssue(
    overrides: Record<string, unknown> = {},
): IssueGetResponseData {
    return {
        number: 5,
        title: "Broken",
        body: "details",
        state: "open",
        locked: false,
        comments: 2,
        created_at: "2026-01-01T00:00:00Z",
        user: {
            login: "alice",
            avatar_url: "https://avatars/alice",
            html_url: "https://github.com/alice",
        },
        author_association: "MEMBER",
        labels: [],
        assignees: [],
        milestone: null,
        ...overrides,
    } as unknown as IssueGetResponseData;
}

function codebergIssue(overrides: Record<string, unknown> = {}): CodebergIssue {
    return {
        id: 11,
        number: 5,
        title: "Broken",
        state: "open",
        html_url: "https://codeberg.org/o/r/issues/5",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        closed_at: null,
        body: "details",
        user: {
            id: 1,
            login: "alice",
            full_name: "Alice",
            avatar_url: "https://avatars/alice",
            html_url: "https://codeberg.org/alice",
        },
        assignees: [{ id: 2, login: "bob", avatar_url: "https://avatars/bob" }],
        labels: [{ id: 3, name: "bug", color: "f00", description: null }],
        milestone: { id: 4, title: "v1" },
        comments: null,
        pull_request: null,
        ...overrides,
    };
}

describe("mapGitHubIssueDetail", () => {
    it("maps author association, state, author and milestone", () => {
        const result = mapGitHubIssueDetail(
            githubIssue({
                state: "closed",
                milestone: {
                    number: 7,
                    title: "v2",
                    html_url: "https://github.com/o/r/milestone/7",
                },
            }),
        );

        expect(result.state).toBe("closed");
        expect(result.authorAssociation).toBe("MEMBER");
        expect(result.author).toEqual({
            login: "alice",
            avatarUrl: "https://avatars/alice",
            profileUrl: "https://github.com/alice",
        });
        expect(result.milestone).toEqual({
            id: "7",
            title: "v2",
            htmlUrl: "https://github.com/o/r/milestone/7",
        });
    });

    it("normalizes string labels and a null body", () => {
        const result = mapGitHubIssueDetail(
            githubIssue({ labels: ["bug"], body: null }),
        );

        expect(result.body).toBe("");
        expect(result.labels).toEqual([
            { id: "", name: "bug", color: "ededed", description: null },
        ]);
    });
});

describe("mapCodebergIssueDetail", () => {
    it("defaults comments to 0 and reports no lock or author association", () => {
        const result = mapCodebergIssueDetail(codebergIssue(), "o", "r");

        expect(result.comments).toBe(0);
        expect(result.locked).toBe(false);
        expect(result.authorAssociation).toBeNull();
    });

    it("carries the provider lock state through", () => {
        const result = mapCodebergIssueDetail(
            codebergIssue({ is_locked: true }),
            "o",
            "r",
        );

        expect(result.locked).toBe(true);
    });

    it("maps labels, assignees and the milestone id", () => {
        const result = mapCodebergIssueDetail(codebergIssue(), "o", "r");

        expect(result.labels).toEqual([
            { id: "3", name: "bug", color: "f00", description: null },
        ]);
        expect(result.assignees).toEqual([
            { login: "bob", avatarUrl: "https://avatars/bob" },
        ]);
        expect(result.milestone?.id).toBe(
            String(codebergIssue().milestone?.id),
        );
        expect(result.milestone?.htmlUrl).toBe(
            "https://codeberg.org/o/r/milestone/4",
        );
    });

    it("falls back to the provider profile URL when html_url is absent", () => {
        const result = mapCodebergIssueDetail(
            codebergIssue({
                user: {
                    id: 1,
                    login: "alice",
                    full_name: "Alice",
                    avatar_url: "https://avatars/alice",
                },
            }),
            "o",
            "r",
        );

        expect(result.author?.profileUrl).toBe("https://codeberg.org/alice");
    });
});

describe("mapPullRequestMetadata", () => {
    it("reads labels, assignees and the milestone number", () => {
        const pr = {
            labels: [{ name: "bug", color: "f00", description: null }],
            assignees: [{ login: "bob", avatar_url: "https://avatars/bob" }],
            milestone: {
                number: 9,
                title: "v3",
                html_url: "https://github.com/o/r/milestone/9",
            },
        } as unknown as PullsGetResponseData;

        const result = mapPullRequestMetadata(pr);

        expect(result.labels).toEqual([
            { id: "", name: "bug", color: "f00", description: null },
        ]);
        expect(result.assignees).toEqual([
            { login: "bob", avatarUrl: "https://avatars/bob" },
        ]);
        expect(result.milestone).toEqual({
            id: "9",
            title: "v3",
            htmlUrl: "https://github.com/o/r/milestone/9",
        });
    });
});

describe("mapCbReaction", () => {
    it("synthesizes a 1-based id and maps the user", () => {
        const reaction: CodebergReaction = {
            content: "heart",
            created_at: "2026-01-01T00:00:00Z",
            user: { login: "bob", avatar_url: "https://avatars/bob" },
        };

        const result = mapCbReaction(reaction, 4);

        expect(result).toEqual({
            databaseId: 5,
            content: "heart",
            createdAt: "2026-01-01T00:00:00Z",
            user: { login: "bob", avatarUrl: "https://avatars/bob" },
        });
    });
});

describe("mapCbReactionCounts", () => {
    it("counts each known content and totals every reaction", () => {
        const counts = mapCbReactionCounts([
            { content: "+1", created_at: "", user: null },
            { content: "+1", created_at: "", user: null },
            { content: "heart", created_at: "", user: null },
            { content: "custom", created_at: "", user: null },
        ]);

        expect(counts["+1"]).toBe(2);
        expect(counts.heart).toBe(1);
        expect(counts.laugh).toBe(0);
        expect(counts.total_count).toBe(4);
    });
});
