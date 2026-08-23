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
    const gqlQuery = `repo:${params.owner}/${params.repo} ${kind} ${params.query}${sortOrder}`;

    const stateAlternatives = options.countStates
        .map((state) => `is:${state}`)
        .join("|");
    const restQuery = params.query
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
