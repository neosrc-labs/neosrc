import { planGithubQuery } from "~/lib/search-boolean";
import type { SearchParams } from "~/server/api/routers/provider";

interface GqlSearchResponse<
    TItem,
    TStateCounts extends Record<string, number>,
> {
    items: TItem[];
    totalCount: number;
    hasNextPage: boolean;
    endCursor: string | null;
    stateCounts: TStateCounts;
}

type GqlSearchFn<
    TItem,
    TStateCounts extends Record<string, number>,
    TCountQueries,
> = (
    accessToken: string,
    gqlQuery: string,
    first: number,
    after: string | null,
    countQueries: TCountQueries,
) => Promise<GqlSearchResponse<TItem, TStateCounts>>;

type GqlSortValues = { created: string; updated: string; comments: number };

export interface SearchGqlOptions<
    TItem,
    TStateCounts extends Record<string, number>,
    TMapped,
    TCountQueries,
> {
    accessToken: string;
    params: SearchParams;
    kind: "pr" | "issue";
    countStates: ReadonlyArray<"open" | "closed" | "merged">;
    search: GqlSearchFn<TItem, TStateCounts, TCountQueries>;
    itemKey: (item: TItem) => number;
    sortValues: (item: TItem) => GqlSortValues;
    mapItem: (item: TItem) => TMapped;
}

// GitHub's search connection caps `first` at 100.
const MAX_PAGE_SIZE = 100;

// Bounds inclusion-exclusion for the union counts; each extra branch doubles
// the intersection terms.
const MAX_UNION_BRANCHES = 4;

function compareValues(left: string | number, right: string | number): number {
    if (typeof left === "number" && typeof right === "number") {
        return left - right;
    }
    return String(left).localeCompare(String(right));
}

// Shared shape of the GitHub PR/issue search procedures: build one GraphQL
// query plus per-state count queries, then map each raw item. A query with OR
// has no single backend form, so it runs one search per disjunctive branch and
// the results are merged.
export async function searchGqlItems<
    TItem,
    TStateCounts extends Record<string, number>,
    TMapped,
    TCountQueries,
>(
    options: SearchGqlOptions<TItem, TStateCounts, TMapped, TCountQueries>,
): Promise<GqlSearchResponse<TMapped, TStateCounts>> {
    const { accessToken, params } = options;
    // The list injects one state qualifier for the whole query. Hoist it so it
    // applies to every branch and so a label-only OR still folds into one query.
    const { state, rest } = splitState(params.query, options.countStates);
    const plan = planGithubQuery(rest);

    if (plan.unsatisfiable) {
        // Asking for and against the same metadata cannot match, and GitHub
        // would answer with the `no:` set instead, so answer without a request.
        return {
            items: [],
            totalCount: 0,
            hasNextPage: false,
            endCursor: null,
            stateCounts: Object.fromEntries(
                options.countStates.map((countState) => [countState, 0]),
            ) as TStateCounts,
        };
    }

    const branches = plan.branches.length > 0 ? plan.branches : [rest];
    const sortOrder =
        params.sort && params.order
            ? ` sort:${params.sort}-${params.order}`
            : "";
    const prefix = `repo:${params.owner}/${params.repo} is:${options.kind}`;
    const buildQuery = (branch: string) =>
        [prefix, state ? `is:${state}` : "", branch]
            .filter(Boolean)
            .join(" ")
            .concat(sortOrder);

    if (branches.length > 1) {
        return searchBranchUnion(
            options,
            branches.slice(0, MAX_UNION_BRANCHES),
            state,
            buildQuery,
        );
    }

    const query = branches[0] ?? "";
    const gqlQuery = buildQuery(query);

    const countQueries = buildCountQueries(
        options,
        query,
    ) as unknown as TCountQueries;

    const result = await options.search(
        accessToken,
        gqlQuery,
        params.first ?? 30,
        params.after ?? null,
        countQueries,
    );

    return { ...result, items: result.items.map(options.mapItem) };
}

// Splits the state qualifier the list injects, which it always puts first, from
// the rest of the query. A state nested inside a branch stays where it is.
function splitState(
    query: string,
    countStates: ReadonlyArray<"open" | "closed" | "merged">,
): { state: "open" | "closed" | "merged" | null; rest: string } {
    const alternatives = countStates.join("|");
    const match = new RegExp(`^\\s*is:(${alternatives})(?=\\s|$)`).exec(query);
    const state =
        (match?.[1] as "open" | "closed" | "merged" | undefined) ?? null;
    if (!match) return { state: null, rest: query.trim() };
    const rest = query.slice(match[0].length).replace(/\s+/g, " ").trim();
    return { state, rest };
}

function buildCountQueries(
    options: {
        countStates: ReadonlyArray<string>;
        params: SearchParams;
        kind: string;
    },
    restQuery: string,
): Record<string, string> {
    const base = `repo:${options.params.owner}/${options.params.repo} is:${options.kind}`;
    return Object.fromEntries(
        options.countStates.map((state) => [
            state,
            `${base} is:${state} ${restQuery}`.trim(),
        ]),
    );
}

async function searchBranchUnion<
    TItem,
    TStateCounts extends Record<string, number>,
    TMapped,
    TCountQueries,
>(
    options: SearchGqlOptions<TItem, TStateCounts, TMapped, TCountQueries>,
    branches: string[],
    activeState: "open" | "closed" | "merged" | null,
    buildQuery: (branch: string) => string,
): Promise<GqlSearchResponse<TMapped, TStateCounts>> {
    const { accessToken, params } = options;
    const first = params.first ?? 30;
    const page = params.page && params.page > 0 ? params.page : 1;
    const window = page * first;

    const results = await Promise.all(
        branches.map(async (terms) => {
            const countQueries = buildCountQueries(
                options,
                terms,
            ) as unknown as TCountQueries;
            const items: TItem[] = [];
            let cursor: string | null = null;
            let stateCounts: TStateCounts | null = null;
            let hasMore = false;

            while (items.length < window) {
                const chunk = Math.min(MAX_PAGE_SIZE, window - items.length);
                const result = await options.search(
                    accessToken,
                    buildQuery(terms),
                    chunk,
                    cursor,
                    countQueries,
                );
                items.push(...result.items);
                stateCounts = result.stateCounts;
                hasMore = result.hasNextPage;
                if (!result.hasNextPage || !result.endCursor) break;
                cursor = result.endCursor;
            }

            return { terms, items, stateCounts, hasMore };
        }),
    );

    // Union counts come from the per-branch totals. GitHub evaluates the
    // intersection of branches unreliably (it drops `assignee:` next to
    // `no:assignee`, for example), so inclusion-exclusion would undercount.
    // Branches that OR combines are normally disjoint (different values of one
    // field, or a presence filter against a value), where the sum is exact.
    const unionCounts: Record<string, number> = {};
    for (const state of options.countStates) {
        unionCounts[state] = results.reduce(
            (sum, result) => sum + (result.stateCounts?.[state] ?? 0),
            0,
        );
    }

    const seen = new Set<number>();
    const merged: TItem[] = [];
    for (const result of results) {
        for (const item of result.items) {
            const key = options.itemKey(item);
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(item);
        }
    }

    const field = params.sort ?? "created";
    const direction = params.order === "asc" ? 1 : -1;
    merged.sort((left, right) => {
        const primary = compareValues(
            options.sortValues(left)[field],
            options.sortValues(right)[field],
        );
        if (primary !== 0) return primary * direction;
        // Stable, deterministic tie break for items sharing a sort value.
        return options.itemKey(right) - options.itemKey(left);
    });

    const start = (page - 1) * first;
    const pageItems = merged.slice(start, start + first).map(options.mapItem);
    const hasNextPage =
        merged.length > start + first ||
        results.some((result) => result.hasMore);

    const totalCount = activeState
        ? (unionCounts[activeState] ?? 0)
        : Object.values(unionCounts).reduce((sum, value) => sum + value, 0);

    return {
        items: pageItems,
        totalCount,
        hasNextPage,
        endCursor: hasNextPage ? `or:${page + 1}` : null,
        stateCounts: unionCounts as TStateCounts,
    };
}
