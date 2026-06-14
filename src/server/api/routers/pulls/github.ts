import { getGitHubToken } from "~/server/auth";
import { searchPullRequestsWithStatus } from "~/server/github-graphql";
import type { Ctx, PullRequestProvider } from "./provider";
import type { PrSearchItem, PrSearchResult, SearchParams } from "./types";

export class GitHubPullRequestProvider implements PullRequestProvider {
    async search(params: SearchParams & { ctx: Ctx }): Promise<PrSearchResult> {
        const accessToken = await getGitHubToken(
            params.ctx.db,
            params.ctx.session.user.id,
        );

        const sortOrder =
            params.sort && params.order
                ? ` sort:${params.sort}-${params.order}`
                : "";
        const gqlQuery = `repo:${params.owner}/${params.repo} is:pr ${params.query}${sortOrder}`;

        const restQuery = params.query.replace(
            /^(is:open|is:closed|is:merged)\s*/,
            "",
        );
        const base = `repo:${params.owner}/${params.repo} is:pr`;
        const countQueries = {
            open: `${base} is:open ${restQuery}`.trim(),
            closed: `${base} is:closed ${restQuery}`.trim(),
            merged: `${base} is:merged ${restQuery}`.trim(),
        };

        const result = await searchPullRequestsWithStatus(
            accessToken,
            gqlQuery,
            params.first ?? 30,
            params.after ?? null,
            countQueries,
        );

        return {
            ...result,
            items: result.items.map(mapGqlItem),
        };
    }
}

function mapGqlItem(item: {
    databaseId: number;
    number: number;
    title: string;
    state: string;
    isDraft: boolean;
    createdAt: string;
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
    assignees: {
        nodes: Array<{ login: string; avatarUrl: string }>;
    };
    comments: { totalCount: number };
    reviewDecision: string | null;
}): PrSearchItem {
    return {
        id: item.databaseId,
        number: item.number,
        title: item.title,
        state: item.state as PrSearchItem["state"],
        isDraft: item.isDraft,
        createdAt: item.createdAt,
        mergedAt: item.mergedAt,
        author: item.author
            ? {
                  login: item.author.login,
                  avatarUrl: item.author.avatarUrl,
                  url: item.author.url,
              }
            : null,
        labels: item.labels.nodes.map((l) => ({
            id: l.id,
            name: l.name,
            color: l.color,
            description: l.description,
        })),
        assignees: item.assignees.nodes.map((a) => ({
            login: a.login,
            avatarUrl: a.avatarUrl,
        })),
        comments: item.comments.totalCount,
        reviewDecision: item.reviewDecision,
    };
}
