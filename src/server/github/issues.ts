import type { RestEndpointMethodTypes } from "@octokit/rest";
import { cache } from "react";
import { createGraphql, isOrgRestrictionError } from "~/server/github-graphql";
import { createOctokit } from "./client";
import type { PullsGetResponseData } from "./pulls";

export type IssueSearchItem = {
    number: number;
    title: string;
    state: string;
    type: "issue" | "pull_request";
    user: { login: string } | null;
};

export const searchIssues = cache(
    async (accessToken: string, owner: string, repo: string, query: string) => {
        const octokit = createOctokit(accessToken);
        const q = query
            ? `repo:${owner}/${repo} state:open ${query} in:title`
            : `repo:${owner}/${repo} state:open`;
        const response = await octokit.search.issuesAndPullRequests({
            q,
            per_page: 5,
            sort: "updated",
            order: "desc",
        });
        return response.data.items.map(
            (item): IssueSearchItem => ({
                number: item.number,
                title: item.title,
                state: item.state,
                type: item.pull_request ? "pull_request" : "issue",
                user: item.user ? { login: item.user.login } : null,
            }),
        );
    },
);
export type Milestone = NonNullable<PullsGetResponseData["milestone"]>;

export const listMilestonesForRepo = async (
    accessToken: string,
    owner: string,
    repo: string,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.issues.listMilestones({
        owner,
        repo,
        state: "open",
        per_page: 100,
    });
    return response.data;
};

export const updateIssueMilestone = async (
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
    milestone: number | null,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        milestone,
    });
    return response.data;
};

export const getIssue = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        issueNumber: number,
    ) => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.issues.get({
            owner,
            repo,
            issue_number: issueNumber,
        });
        return response.data;
    },
);

export type IssueGetResponseData =
    RestEndpointMethodTypes["issues"]["get"]["response"]["data"];

export const listLabelsForRepo = async (
    accessToken: string,
    owner: string,
    repo: string,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.issues.listLabelsForRepo({
        owner,
        repo,
    });
    return response.data;
};

export const addLabelsToIssue = async (
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
    labels: string[],
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.issues.addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels,
    });
    return response.data;
};

export const removeLabelFromIssue = async (
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
    labelName: string,
) => {
    const octokit = createOctokit(accessToken);
    await octokit.issues.removeLabel({
        owner,
        repo,
        issue_number: issueNumber,
        name: labelName,
    });
};

export const listRepoAssignees = async (
    accessToken: string,
    owner: string,
    repo: string,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.issues.listAssignees({
        owner,
        repo,
        per_page: 100,
    });
    return response.data;
};

export const addAssigneesToIssue = async (
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
    assignees: string[],
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.issues.addAssignees({
        owner,
        repo,
        issue_number: issueNumber,
        assignees,
    });
    return response.data;
};

export const removeAssigneesFromIssue = async (
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
    assignees: string[],
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.issues.removeAssignees({
        owner,
        repo,
        issue_number: issueNumber,
        assignees,
    });
    return response.data;
};

export const listRecentIssueAuthors = async (
    accessToken: string,
    owner: string,
    repo: string,
) => {
    const graphql = createGraphql(accessToken);

    // REST listForRepo returns both issues and pull requests, so the query
    // unions both connections to preserve that behavior.
    const query = `
query RecentIssueAuthors($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    issues(first: 100, orderBy: { field: CREATED_AT, direction: DESC }) {
      nodes {
        createdAt
        author {
          login
          avatarUrl
        }
      }
    }
    pullRequests(first: 100, orderBy: { field: CREATED_AT, direction: DESC }) {
      nodes {
        createdAt
        author {
          login
          avatarUrl
        }
      }
    }
  }
}`;

    try {
        const result = await graphql<{
            repository?: {
                issues: {
                    nodes: Array<{
                        author: { login: string; avatarUrl: string } | null;
                        createdAt: string;
                    } | null>;
                };
                pullRequests: {
                    nodes: Array<{
                        author: { login: string; avatarUrl: string } | null;
                        createdAt: string;
                    } | null>;
                };
            } | null;
        }>(query, { owner, repo });

        // Merge both connections newest-first and cap at one page of 100,
        // matching what the REST fallback returns.
        const nodes = [
            ...(result.repository?.issues?.nodes ?? []),
            ...(result.repository?.pullRequests?.nodes ?? []),
        ]
            .filter((node): node is NonNullable<typeof node> => node != null)
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
            .slice(0, 100);

        const seen = new Set<string>();
        const authors: Array<{
            login: string;
            avatar_url: string | null;
        }> = [];
        for (const node of nodes) {
            if (!node?.author) continue;
            if (seen.has(node.author.login)) continue;
            seen.add(node.author.login);
            authors.push({
                login: node.author.login,
                avatar_url: node.author.avatarUrl,
            });
        }
        return authors;
    } catch (error) {
        if (!isOrgRestrictionError(error)) throw error;
        return listRecentIssueAuthorsRest(accessToken, owner, repo);
    }
};

/**
 * REST fallback for listRecentIssueAuthors. issues.listForRepo returns both
 * issues and pull requests, matching the graphql query's union.
 */
async function listRecentIssueAuthorsRest(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<Array<{ login: string; avatar_url: string | null }>> {
    const octokit = createOctokit(accessToken);
    const response = await octokit.issues.listForRepo({
        owner,
        repo,
        state: "all",
        sort: "created",
        direction: "desc",
        per_page: 100,
    });

    const seen = new Set<string>();
    const authors: Array<{ login: string; avatar_url: string | null }> = [];
    for (const issue of response.data) {
        if (issue.user && !seen.has(issue.user.login)) {
            seen.add(issue.user.login);
            authors.push({
                login: issue.user.login,
                avatar_url: issue.user.avatar_url ?? null,
            });
        }
    }
    return authors;
}
