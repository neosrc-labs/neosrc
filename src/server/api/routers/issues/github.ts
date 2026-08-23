import { searchGqlItems } from "~/server/api/routers/github-search";
import { mapGqlIssueSearchItem } from "~/server/api/routers/mappers";
import type { Ctx, SearchParams } from "~/server/api/routers/provider";
import { getGitHubToken } from "~/server/auth";
import { searchIssuesWithMetadata } from "~/server/github-graphql";
import type { IssueProvider } from "./provider";
import type { IssueSearchResult } from "./types";

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
            mapItem: mapGqlIssueSearchItem,
        });
    }
}
