import {
    createGraphql,
    type GraphqlClient,
} from "~/server/github/graphql-client";
export interface GqlPrSearchItem {
    databaseId: number;
    number: number;
    title: string;
    state: string;
    isDraft: boolean;
    createdAt: string;
    updatedAt: string;
    mergedAt: string | null;
    author: { login: string; avatarUrl: string; url: string } | null;
    labels: {
        nodes: Array<{
            id: string;
            name: string;
            color: string;
            description: string | null;
        }>;
    };
    assignees: { nodes: Array<{ login: string; avatarUrl: string }> };
    comments: { totalCount: number };
    reviewDecision: string | null;
    stack: { size: number; number: number } | null;
    stackEntry: { position: number } | null;
}

type SearchPage<TName extends string, TItem> = {
    search: {
        issueCount: number;
        pageInfo: { endCursor: string | null; hasNextPage: boolean };
        nodes: Array<
            ({ __typename: TName } & TItem) | { __typename: string } | null
        >;
    };
};

type CountResults = Record<string, { issueCount: number } | undefined>;

/**
 * Runs a search page query and its count query together, then filters the
 * mixed-type search nodes down to the wanted typename. Shared by the pull
 * request and issue search entry points, whose result shapes match apart
 * from their item and state-count fields.
 */
async function searchGqlItems<TName extends string, TItem>(
    graphql: GraphqlClient,
    searchQuery: string,
    countQuery: string,
    pageVars: { searchQuery: string; first: number; after: string | null },
    countVars: Record<string, string>,
    typename: TName,
): Promise<{
    items: ({ __typename: TName } & TItem)[];
    totalCount: number;
    hasNextPage: boolean;
    endCursor: string | null;
    counts: CountResults;
}> {
    const [result, countResult] = await Promise.all([
        graphql<SearchPage<TName, TItem>>(searchQuery, pageVars),
        graphql<CountResults>(countQuery, countVars),
    ]);

    const items = result.search.nodes.filter(
        (n): n is { __typename: TName } & TItem => n?.__typename === typename,
    );

    return {
        items,
        totalCount: result.search.issueCount,
        hasNextPage: result.search.pageInfo.hasNextPage,
        endCursor: result.search.pageInfo.endCursor,
        counts: countResult ?? {},
    };
}

const PR_SEARCH_QUERY = `
query SearchPRs($searchQuery: String!, $first: Int!, $after: String) {
  search(query: $searchQuery, type: ISSUE, first: $first, after: $after) {
    issueCount
    pageInfo {
      endCursor
      hasNextPage
    }
    nodes {
      __typename
      ... on PullRequest {
        databaseId
        number
        title
        state
        isDraft
        createdAt
        updatedAt
        mergedAt
        author { login avatarUrl url }
        labels(first: 10) {
          nodes { id name color description }
        }
        assignees(first: 3) {
          nodes { login avatarUrl }
        }
        comments { totalCount }
        reviewDecision
        stack {
          size
          number
        }
        stackEntry {
          position
        }
      }
    }
  }
}
`;

const COUNT_PR_QUERY = `
query CountPRs($openQuery: String!, $closedQuery: String!, $mergedQuery: String!) {
  open: search(query: $openQuery, type: ISSUE, first: 1) { issueCount }
  closed: search(query: $closedQuery, type: ISSUE, first: 1) { issueCount }
  merged: search(query: $mergedQuery, type: ISSUE, first: 1) { issueCount }
}
`;

export async function searchPullRequestsWithStatus(
    accessToken: string,
    query: string,
    first: number = 30,
    after: string | null = null,
    countQueries: { open: string; closed: string; merged: string },
) {
    const graphql = createGraphql(accessToken);

    const { items, totalCount, hasNextPage, endCursor, counts } =
        await searchGqlItems<"PullRequest", GqlPrSearchItem>(
            graphql,
            PR_SEARCH_QUERY,
            COUNT_PR_QUERY,
            { searchQuery: query, first, after },
            {
                openQuery: countQueries.open,
                closedQuery: countQueries.closed,
                mergedQuery: countQueries.merged,
            },
            "PullRequest",
        );

    return {
        items,
        totalCount,
        hasNextPage,
        endCursor,
        stateCounts: {
            open: counts.open?.issueCount ?? 0,
            closed: counts.closed?.issueCount ?? 0,
            merged: counts.merged?.issueCount ?? 0,
        },
    };
}

export interface GqlIssueSearchItem {
    databaseId: number;
    number: number;
    title: string;
    state: string;
    stateReason: "COMPLETED" | "DUPLICATE" | "NOT_PLANNED" | null;
    createdAt: string;
    updatedAt: string;
    closedAt: string | null;
    author: { login: string; avatarUrl: string; url: string } | null;
    labels: {
        nodes: Array<{
            id: string;
            name: string;
            color: string;
            description: string | null;
        }>;
    };
    assignees: { nodes: Array<{ login: string; avatarUrl: string }> };
    comments: { totalCount: number };
}

const PINNED_ISSUES_QUERY = `
query PinnedIssues($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    pinnedIssues(first: 3) {
      nodes {
        issue {
          databaseId
          number
          title
          state
          stateReason
          createdAt
          updatedAt
          closedAt
          author { login avatarUrl url }
          labels(first: 10) {
            nodes { id name color description }
          }
          assignees(first: 5) {
            nodes { login avatarUrl }
          }
          comments { totalCount }
        }
      }
    }
  }
}
`;

export async function getPinnedIssuesGraphQL(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<GqlIssueSearchItem[]> {
    const graphql = createGraphql(accessToken);
    const data = await graphql<{
        repository: {
            pinnedIssues: {
                nodes: Array<{ issue: GqlIssueSearchItem }>;
            };
        } | null;
    }>(PINNED_ISSUES_QUERY, { owner, repo });

    return data.repository?.pinnedIssues.nodes.map((node) => node.issue) ?? [];
}

const ISSUE_SEARCH_QUERY = `
query SearchIssues($searchQuery: String!, $first: Int!, $after: String) {
  search(query: $searchQuery, type: ISSUE, first: $first, after: $after) {
    issueCount
    pageInfo {
      endCursor
      hasNextPage
    }
    nodes {
      __typename
      ... on Issue {
        databaseId
        number
        title
        state
        stateReason
        createdAt
        updatedAt
        closedAt
        author { login avatarUrl url }
        labels(first: 10) {
          nodes { id name color description }
        }
        assignees(first: 5) {
          nodes { login avatarUrl }
        }
        comments { totalCount }
      }
    }
  }
}
`;

const COUNT_ISSUE_QUERY = `
query CountIssues($openQuery: String!, $closedQuery: String!) {
  open: search(query: $openQuery, type: ISSUE, first: 1) { issueCount }
  closed: search(query: $closedQuery, type: ISSUE, first: 1) { issueCount }
}
`;

export async function searchIssuesWithMetadata(
    accessToken: string,
    query: string,
    first: number = 30,
    after: string | null = null,
    countQueries: { open: string; closed: string },
) {
    const graphql = createGraphql(accessToken);

    const { items, totalCount, hasNextPage, endCursor, counts } =
        await searchGqlItems<"Issue", GqlIssueSearchItem>(
            graphql,
            ISSUE_SEARCH_QUERY,
            COUNT_ISSUE_QUERY,
            { searchQuery: query, first, after },
            {
                openQuery: countQueries.open,
                closedQuery: countQueries.closed,
            },
            "Issue",
        );

    return {
        items,
        totalCount,
        hasNextPage,
        endCursor,
        stateCounts: {
            open: counts.open?.issueCount ?? 0,
            closed: counts.closed?.issueCount ?? 0,
        },
    };
}
