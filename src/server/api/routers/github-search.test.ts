import { describe, expect, it } from "vitest";
import { searchGqlItems } from "~/server/api/routers/github-search";
import type { SearchParams } from "~/server/api/routers/provider";

const baseParams: SearchParams = {
    owner: "own",
    repo: "repo",
    query: "",
    first: 10,
};

// Test seam: runs searchGqlItems with a stub search fn and captures the
// per-state count queries it builds.
async function captureCountQueries(options: {
    query: string;
    kind: "pr" | "issue";
    countStates: ReadonlyArray<"open" | "closed" | "merged">;
}): Promise<Record<string, string>> {
    let captured: Record<string, string> = {};
    await searchGqlItems({
        accessToken: "tok",
        params: { ...baseParams, query: options.query },
        kind: options.kind,
        countStates: options.countStates,
        search: async (_t, _q, _f, _a, countQueries) => {
            captured = countQueries as Record<string, string>;
            return {
                items: [],
                totalCount: 0,
                hasNextPage: false,
                endCursor: null,
                stateCounts: {} as Record<string, number>,
            };
        },
        mapItem: (item) => item,
    });
    return captured;
}

describe("searchGqlItems count queries", () => {
    it("strips a leading state token before building each count query", async () => {
        const counts = await captureCountQueries({
            query: "is:open author:alice",
            kind: "issue",
            countStates: ["open", "closed"],
        });

        expect(counts.open).toBe("repo:own/repo is:issue is:open author:alice");
        expect(counts.closed).toBe(
            "repo:own/repo is:issue is:closed author:alice",
        );
    });

    it("strips state tokens appearing after other qualifiers", async () => {
        const counts = await captureCountQueries({
            query: "author:alice is:closed label:bug",
            kind: "pr",
            countStates: ["open", "closed", "merged"],
        });

        expect(counts.open).toBe(
            "repo:own/repo is:pr is:open author:alice label:bug",
        );
        expect(counts.closed).toBe(
            "repo:own/repo is:pr is:closed author:alice label:bug",
        );
        expect(counts.merged).toBe(
            "repo:own/repo is:pr is:merged author:alice label:bug",
        );
    });

    it("keeps non-state qualifiers in every count query", async () => {
        const counts = await captureCountQueries({
            query: 'label:"good first issue"',
            kind: "issue",
            countStates: ["open"],
        });

        expect(counts.open).toContain('label:"good first issue"');
    });
});
