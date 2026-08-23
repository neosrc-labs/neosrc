import { searchGqlItems } from "~/server/api/routers/github-search";
import { mapGqlPrSearchItem } from "~/server/api/routers/mappers";
import type { Ctx, SearchParams } from "~/server/api/routers/provider";
import { getGitHubToken } from "~/server/auth";
import { searchPullRequestsWithStatus } from "~/server/github-graphql";
import type { PullRequestProvider } from "./provider";
import type { PrSearchResult } from "./types";

export class GitHubPullRequestProvider implements PullRequestProvider {
    async search(params: SearchParams & { ctx: Ctx }): Promise<PrSearchResult> {
        const accessToken = await getGitHubToken(
            params.ctx.db,
            params.ctx.session?.user?.id,
        );

        return searchGqlItems({
            accessToken,
            params,
            kind: "pr",
            countStates: ["open", "closed", "merged"],
            search: searchPullRequestsWithStatus,
            mapItem: mapGqlPrSearchItem,
        });
    }
}
