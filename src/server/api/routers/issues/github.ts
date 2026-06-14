import { getGitHubToken } from "~/server/auth";
import { searchIssuesWithMetadata } from "~/server/github-graphql";
import type { Ctx, IssueProvider } from "./provider";
import type { IssueSearchItem, IssueSearchResult, SearchParams } from "./types";

export class GitHubIssueProvider implements IssueProvider {
    async search(
        params: SearchParams & { ctx: Ctx },
    ): Promise<IssueSearchResult> {
        const accessToken = await getGitHubToken(
            params.ctx.db,
            params.ctx.session.user.id,
        );

        const sortOrder =
            params.sort && params.order
                ? ` sort:${params.sort}-${params.order}`
                : "";
        const gqlQuery = `repo:${params.owner}/${params.repo} is:issue ${params.query}${sortOrder}`;

        const restQuery = params.query.replace(/^(is:open|is:closed)\s*/, "");
        const base = `repo:${params.owner}/${params.repo} is:issue`;
        const countQueries = {
            open: `${base} is:open ${restQuery}`.trim(),
            closed: `${base} is:closed ${restQuery}`.trim(),
        };

        const result = await searchIssuesWithMetadata(
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
    createdAt: string;
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
}): IssueSearchItem {
    return {
        number: item.number,
        title: item.title,
        state: item.state as IssueSearchItem["state"],
        createdAt: item.createdAt,
        closedAt: item.closedAt,
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
    };
}
