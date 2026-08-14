/**
 * Shared search types and query-parsing helpers for the issues and pulls
 * routers. The two routers' search flows build the same GitHub/Codeberg
 * queries and share item field shapes, so that logic lives here instead of
 * being duplicated in each provider.
 */

export interface SearchParams {
    owner: string;
    repo: string;
    query: string;
    page?: number;
    after?: string;
    first?: number;
    sort?: "created" | "updated" | "comments";
    order?: "asc" | "desc";
}

export interface SearchAuthor {
    login: string;
    avatarUrl: string;
    url: string;
}

export interface SearchLabel {
    id: string;
    name: string;
    color: string;
    description: string | null;
}

export interface SearchAssignee {
    login: string;
    avatarUrl: string;
}

/**
 * The shared GQL node shape behind a search item: author plus the nested
 * labels/assignees/comments nodes that the github providers unwrap.
 */
export interface GqlSearchItemShape {
    author: SearchAuthor | null;
    labels: { nodes: SearchLabel[] };
    assignees: { nodes: SearchAssignee[] };
    comments: { totalCount: number };
}

/**
 * GitHub search query (GQL `repo:…` qualifier string) plus the REST-style
 * per-state count queries used for the tab badges. `kind` picks the object
 * type and which states count queries are built for.
 */
export function buildGithubSearchQueries(
    params: SearchParams,
    kind: "issue" | "pr",
): {
    gqlQuery: string;
    countQueries: { open: string; closed: string; merged: string };
} {
    const sortOrder =
        params.sort && params.order
            ? ` sort:${params.sort}-${params.order}`
            : "";
    const gqlQuery = `repo:${params.owner}/${params.repo} is:${kind} ${params.query}${sortOrder}`;

    const stateRegex =
        kind === "pr"
            ? /^(is:open|is:closed|is:merged)\s*/
            : /^(is:open|is:closed)\s*/;
    const restQuery = params.query.replace(stateRegex, "");
    const base = `repo:${params.owner}/${params.repo} is:${kind}`;
    const countQueries = {
        open: `${base} is:open ${restQuery}`.trim(),
        closed: `${base} is:closed ${restQuery}`.trim(),
        merged: `${base} is:merged ${restQuery}`.trim(),
    };
    return { gqlQuery, countQueries };
}

/**
 * Runs a GitHub search through the shared flow: builds the GQL query plus the
 * per-state count queries, executes the provider search, and maps the result
 * items. Used by both the issues and pulls GitHub providers.
 */
export async function searchGithubWithCounts<TItem, TOut>(
    accessToken: string,
    params: SearchParams,
    kind: "issue" | "pr",
    search: (
        accessToken: string,
        gqlQuery: string,
        first: number,
        after: string | null,
        countQueries: { open: string; closed: string; merged: string },
    ) => Promise<{
        items: TItem[];
        totalCount: number;
        hasNextPage: boolean;
        endCursor: string | null;
        stateCounts: { open: number; closed: number } & Record<string, number>;
    }>,
    map: (item: TItem) => TOut,
): Promise<{
    items: TOut[];
    totalCount: number;
    hasNextPage: boolean;
    endCursor: string | null;
    stateCounts: { open: number; closed: number } & Record<string, number>;
}> {
    const { gqlQuery, countQueries } = buildGithubSearchQueries(params, kind);
    const result = await search(
        accessToken,
        gqlQuery,
        params.first ?? 30,
        params.after ?? null,
        countQueries,
    );
    return { ...result, items: result.items.map(map) };
}

/**
 * Parses the qualifiers Codeberg's list endpoints understand out of a search
 * query: the author, quoted/unquoted labels, the sort key, and pagination.
 */
export function parseCodebergSearch(params: SearchParams): {
    authorQualifier: string | undefined;
    labelQualifiers: string[];
    cbSort: string;
    page: number;
    limit: number;
} {
    const authorMatch = params.query.match(/author:(\S+)/);
    const authorQualifier = authorMatch?.[1];

    const labelRegex = /label:\s*("[^"]*"|\S+)/g;
    const labelQualifiers: string[] = [];
    const allLabelMatches = params.query.matchAll(labelRegex);
    for (const m of allLabelMatches) {
        const name = (m[1] ?? "").replace(/^"|"$/g, "");
        if (name) labelQualifiers.push(name);
    }

    const sortMap: Record<string, string | undefined> = {
        "created-desc": "newest",
        "created-asc": "oldest",
        "updated-desc": "recentupdate",
        "updated-asc": "leastupdate",
        "comments-desc": "mostcomment",
        "comments-asc": "leastcomment",
    };
    const sortKey =
        params.sort && params.order
            ? `${params.sort}-${params.order}`
            : "created-desc";
    const cbSort = sortMap[sortKey] ?? "newest";

    return {
        authorQualifier,
        labelQualifiers,
        cbSort,
        page: params.page ?? 1,
        limit: params.first ?? 30,
    };
}
