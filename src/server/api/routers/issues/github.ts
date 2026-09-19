import { searchGqlItems } from "~/server/api/routers/github-search";
import { mapGqlIssueSearchItem } from "~/server/api/routers/mappers";
import type { Ctx, SearchParams } from "~/server/api/routers/provider";
import { getGitHubToken } from "~/server/auth";
import {
    getPinnedIssuesGraphQL,
    searchIssuesWithMetadata,
} from "~/server/github-graphql";
import type { IssueProvider } from "./provider";
import type { IssueSearchItem, IssueSearchResult } from "./types";

export class GitHubIssueProvider implements IssueProvider {
    async search(
        params: SearchParams & { ctx: Ctx },
    ): Promise<IssueSearchResult> {
        const accessToken = await getGitHubToken(
            params.ctx.db,
            params.ctx.session?.user?.id,
        );

        return searchGqlItems({
            accessToken,
            params,
            kind: "issue",
            countStates: ["open", "closed"],
            search: searchIssuesWithMetadata,
            itemKey: (item) => item.databaseId,
            sortValues: (item) => ({
                created: item.createdAt,
                updated: item.updatedAt,
                comments: item.comments.totalCount,
            }),
            mapItem: mapGqlIssueSearchItem,
        });
    }

    async pinned({
        owner,
        repo,
        ctx,
    }: {
        owner: string;
        repo: string;
        ctx: Ctx;
    }): Promise<IssueSearchItem[]> {
        const accessToken = await getGitHubToken(ctx.db, ctx.session?.user?.id);
        const issues = await getPinnedIssuesGraphQL(accessToken, owner, repo);
        return issues.map(mapGqlIssueSearchItem);
    }
}
