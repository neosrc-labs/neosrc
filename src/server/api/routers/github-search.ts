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

// GitHub's issue-page filters accept has:, but the search service this app
// queries ignores it. Only assignee has a wildcard form, so the remaining has:
// values cannot be expressed; the native no: qualifiers pass through untouched.
const HAS_ASSIGNEE_RE = /(?<=^|\s)has:assignee(?=\s|$)/g;

export function normalizeGithubSearchQuery(query: string): string {
    return query.replace(HAS_ASSIGNEE_RE, "assignee:*");
}

// Shared shape of the GitHub PR/issue search procedures: build one GraphQL
// query plus per-state count queries, then map each raw item.
export async function searchGqlItems<
    TItem,
    TStateCounts extends Record<string, number>,
    TMapped,
    TCountQueries,
>(options: {
    accessToken: string;
    params: SearchParams;
    kind: "pr" | "issue";
    countStates: ReadonlyArray<"open" | "closed" | "merged">;
    search: GqlSearchFn<TItem, TStateCounts, TCountQueries>;
    mapItem: (item: TItem) => TMapped;
}): Promise<GqlSearchResponse<TMapped, TStateCounts>> {
    const { accessToken, params } = options;
    const sortOrder =
        params.sort && params.order
            ? ` sort:${params.sort}-${params.order}`
            : "";
    const kind = `is:${options.kind}`;
    const query = normalizeGithubSearchQuery(params.query);
    const gqlQuery = `repo:${params.owner}/${params.repo} ${kind} ${query}${sortOrder}`;

    const stateAlternatives = options.countStates
        .map((state) => `is:${state}`)
        .join("|");
    const restQuery = query
        .replace(
            new RegExp(`(?<=^|\\s)(${stateAlternatives})(?=\\s|$)`, "g"),
            " ",
        )
        .replace(/\s+/g, " ")
        .trim();
    const base = `repo:${params.owner}/${params.repo} ${kind}`;
    const countQueries = Object.fromEntries(
        options.countStates.map((state) => [
            state,
            `${base} is:${state} ${restQuery}`.trim(),
        ]),
    ) as TCountQueries;

    const result = await options.search(
        accessToken,
        gqlQuery,
        params.first ?? 30,
        params.after ?? null,
        countQueries,
    );

    return { ...result, items: result.items.map(options.mapItem) };
}
