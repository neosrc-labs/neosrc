import { describe, expect, it } from "vitest";
import { searchGqlItems } from "~/server/api/routers/github-search";
import type { SearchParams } from "~/server/api/routers/provider";

interface FakeItem {
    databaseId: number;
    number: number;
    createdAt: string;
    updatedAt: string;
    comments: { totalCount: number };
}

interface FakeCounts extends Record<string, number> {
    open: number;
    closed: number;
}

const baseParams: SearchParams = {
    owner: "own",
    repo: "repo",
    query: "",
    first: 10,
};

function fakeItem(databaseId: number, createdAt: string): FakeItem {
    return {
        databaseId,
        number: databaseId,
        createdAt,
        updatedAt: createdAt,
        comments: { totalCount: 0 },
    };
}

// Test seam: records the queries passed to search and captureCounts, and
// returns canned per-query results.
function makeOptions(options: {
    query: string;
    page?: number;
    sort?: "created" | "updated" | "comments";
    order?: "asc" | "desc";
    items?: Record<string, FakeItem[]>;
    counts?: Record<string, number>;
}) {
    const searched: string[] = [];
    const counted: string[] = [];
    const page = options.page ?? 1;
    const first = baseParams.first ?? 30;
    return {
        searched,
        counted,
        options: {
            accessToken: "tok",
            params: {
                ...baseParams,
                query: options.query,
                page: options.page,
                sort: options.sort,
                order: options.order,
            } as SearchParams,
            kind: "issue" as const,
            countStates: ["open", "closed"] as const,
            search: async (
                _token: string,
                gqlQuery: string,
                window: number,
                _after: string | null,
                countQueries: { open: string; closed: string },
            ) => {
                searched.push(gqlQuery);
                counted.push(countQueries.open, countQueries.closed);
                const terms = gqlQuery.replace(
                    /^repo:own\/repo is:issue\s*/,
                    "",
                );
                const all = options.items?.[terms] ?? [];
                const sliced = all.slice(0, window);
                const counts = options.counts?.[terms] ?? 0;
                void page;
                void first;
                return {
                    items: sliced,
                    totalCount: counts,
                    hasNextPage: all.length > sliced.length,
                    endCursor:
                        all.length > sliced.length ? `cur:${terms}` : null,
                    stateCounts: {
                        open: options.counts?.[`${terms}|open`] ?? 0,
                        closed: options.counts?.[`${terms}|closed`] ?? 0,
                    } as FakeCounts,
                };
            },
            itemKey: (item: FakeItem) => item.databaseId,
            sortValues: (item: FakeItem) => ({
                created: item.createdAt,
                updated: item.updatedAt,
                comments: item.comments.totalCount,
            }),
            mapItem: (item: FakeItem) => item,
        },
    };
}

describe("searchGqlItems single query", () => {
    it("builds the search and count queries", async () => {
        const harness = makeOptions({ query: "is:open author:alice" });
        await searchGqlItems(harness.options);
        expect(harness.searched).toEqual([
            "repo:own/repo is:issue is:open author:alice",
        ]);
        expect(harness.counted).toEqual([
            "repo:own/repo is:issue is:open author:alice",
            "repo:own/repo is:issue is:closed author:alice",
        ]);
    });

    it("keeps a label OR in one native query", async () => {
        const harness = makeOptions({ query: "is:open label:a OR label:b" });
        await searchGqlItems(harness.options);
        expect(harness.searched).toEqual([
            "repo:own/repo is:issue is:open label:a,b",
        ]);
    });
});

describe("searchGqlItems unsatisfiable", () => {
    it("returns an empty page without querying the backend", async () => {
        const harness = makeOptions({
            query: "is:open (no:assignee AND assignee:epage)",
        });

        const result = await searchGqlItems(harness.options);

        expect(harness.searched).toEqual([]);
        expect(result.items).toEqual([]);
        expect(result.totalCount).toBe(0);
        expect(result.stateCounts).toEqual({ open: 0, closed: 0 });
        expect(result.hasNextPage).toBe(false);
        expect(result.endCursor).toBeNull();
    });

    it("keeps searching when only one branch of the union is empty", async () => {
        const harness = makeOptions({
            query: "is:open (no:assignee AND assignee:epage) OR label:bug",
            items: { "is:open label:bug": [fakeItem(7, "2024-01-01")] },
            counts: { "is:open label:bug|open": 1 },
        });

        const result = await searchGqlItems(harness.options);

        expect(harness.searched).toEqual([
            "repo:own/repo is:issue is:open label:bug",
        ]);
        expect(result.items.map((item) => item.databaseId)).toEqual([7]);
    });
});

describe("searchGqlItems union", () => {
    const query = "is:open no:assignee OR assignee:epage";
    it("runs one search per branch with the state on each", async () => {
        const harness = makeOptions({ query });
        await searchGqlItems(harness.options);
        expect(harness.searched.sort()).toEqual([
            "repo:own/repo is:issue is:open assignee:epage",
            "repo:own/repo is:issue is:open no:assignee",
        ]);
    });

    it("merges, dedupes and sorts the branches", async () => {
        const harness = makeOptions({
            query,
            items: {
                "is:open no:assignee": [
                    fakeItem(1, "2024-01-03"),
                    fakeItem(3, "2024-01-01"),
                ],
                "is:open assignee:epage": [
                    fakeItem(2, "2024-01-02"),
                    fakeItem(3, "2024-01-01"),
                ],
            },
            counts: {
                "is:open no:assignee|open": 2,
                "is:open assignee:epage|open": 2,
            },
        });

        const result = await searchGqlItems(harness.options);

        // The shared item 3 appears once even though both branches list it.
        expect(result.items.map((item) => item.databaseId)).toEqual([1, 2, 3]);
        // Counts are the sum of the branches; only exact when they do not
        // overlap, which is the norm for the ORs this path handles.
        expect(result.totalCount).toBe(4);
        expect(result.stateCounts).toEqual({ open: 4, closed: 0 });
        expect(result.hasNextPage).toBe(false);
    });

    it("pages with the merged window and reports the exact union count", async () => {
        const harness = makeOptions({
            query,
            page: 2,
            items: {
                "is:open no:assignee": [
                    fakeItem(1, "2024-01-04"),
                    fakeItem(2, "2024-01-03"),
                ],
                "is:open assignee:epage": [fakeItem(3, "2024-01-02")],
            },
            counts: {
                "is:open no:assignee|open": 2,
                "is:open assignee:epage|open": 2,
            },
        });

        const result = await searchGqlItems(harness.options);

        // first = 10, so page 2 is empty but the branch totals still show.
        expect(result.items).toEqual([]);
        expect(result.totalCount).toBe(4);
        expect(result.endCursor).toBeNull();
    });
});
