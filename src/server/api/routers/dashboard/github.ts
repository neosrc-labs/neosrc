import { createGraphql } from "~/server/github-graphql";
import type { ViewerIssueItem, ViewerPullItem } from "./types";

// GitHub caps a search page at 100 nodes.
const MAX_PAGE_SIZE = 100;

type SearchNodes<TName extends string, TItem> = {
    search: {
        nodes: Array<
            ({ __typename: TName } & TItem) | { __typename: string } | null
        >;
    };
};

interface GqlViewerPull {
    number: number;
    title: string;
    isDraft: boolean;
    updatedAt: string;
    comments: { totalCount: number };
    repository: { nameWithOwner: string };
}

interface GqlViewerIssue {
    number: number;
    title: string;
    updatedAt: string;
    comments: { totalCount: number };
    repository: { nameWithOwner: string };
}

const VIEWER_PULLS_QUERY = `
query ViewerPulls($searchQuery: String!, $first: Int!) {
  search(query: $searchQuery, type: ISSUE, first: $first) {
    nodes {
      __typename
      ... on PullRequest {
        number
        title
        isDraft
        updatedAt
        comments { totalCount }
        repository { nameWithOwner }
      }
    }
  }
}
`;

const VIEWER_ISSUES_QUERY = `
query ViewerIssues($searchQuery: String!, $first: Int!) {
  search(query: $searchQuery, type: ISSUE, first: $first) {
    nodes {
      __typename
      ... on Issue {
        number
        title
        updatedAt
        comments { totalCount }
        repository { nameWithOwner }
      }
    }
  }
}
`;

async function searchViewerNodes<TName extends string, TItem>(
    accessToken: string,
    gqlQuery: string,
    searchQuery: string,
    typename: TName,
    first: number,
): Promise<Array<{ __typename: TName } & TItem>> {
    const graphql = createGraphql(accessToken);
    const result = await graphql<SearchNodes<TName, TItem>>(gqlQuery, {
        searchQuery,
        first: Math.min(first, MAX_PAGE_SIZE),
    });

    return result.search.nodes.filter(
        (node): node is { __typename: TName } & TItem =>
            node?.__typename === typename,
    );
}

/** Open pull requests the viewer authored, newest activity first. */
export async function fetchViewerPulls(
    accessToken: string,
    first: number,
): Promise<ViewerPullItem[]> {
    const nodes = await searchViewerNodes<"PullRequest", GqlViewerPull>(
        accessToken,
        VIEWER_PULLS_QUERY,
        "is:pr author:@me is:open sort:updated-desc",
        "PullRequest",
        first,
    );

    return nodes.map((node) => ({
        provider: "gh",
        repo: node.repository.nameWithOwner,
        number: node.number,
        title: node.title,
        isDraft: node.isDraft,
        updatedAt: node.updatedAt,
        comments: node.comments.totalCount,
    }));
}

/** Open issues the viewer authored, newest activity first. */
export async function fetchViewerIssues(
    accessToken: string,
    first: number,
): Promise<ViewerIssueItem[]> {
    const nodes = await searchViewerNodes<"Issue", GqlViewerIssue>(
        accessToken,
        VIEWER_ISSUES_QUERY,
        "is:issue author:@me is:open sort:updated-desc",
        "Issue",
        first,
    );

    return nodes.map((node) => ({
        provider: "gh",
        repo: node.repository.nameWithOwner,
        number: node.number,
        title: node.title,
        updatedAt: node.updatedAt,
        comments: node.comments.totalCount,
    }));
}
