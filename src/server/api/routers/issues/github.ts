import { getGhToken } from "~/server/api/routers/helpers";
import {
    mapGqlAssignee,
    mapGqlAuthor,
    mapGqlLabel,
} from "~/server/api/routers/mappers";
import {
    type GqlSearchItemShape,
    type SearchParams,
    searchGithubWithCounts,
} from "~/server/api/routers/search-shared";
import { searchIssuesWithMetadata } from "~/server/github-graphql";
import type { Ctx, IssueProvider } from "./provider";
import type { IssueSearchItem, IssueSearchResult } from "./types";

export class GitHubIssueProvider implements IssueProvider {
    async search(
        params: SearchParams & { ctx: Ctx },
    ): Promise<IssueSearchResult> {
        const accessToken = await getGhToken(params.ctx);

        return searchGithubWithCounts(
            accessToken,
            params,
            "issue",
            searchIssuesWithMetadata,
            mapGqlItem,
        );
    }
}

function mapGqlItem(
    item: GqlSearchItemShape & {
        databaseId: number;
        number: number;
        title: string;
        state: string;
        createdAt: string;
        closedAt: string | null;
    },
): IssueSearchItem {
    return {
        number: item.number,
        title: item.title,
        state: item.state as IssueSearchItem["state"],
        createdAt: item.createdAt,
        closedAt: item.closedAt,
        author: mapGqlAuthor(item.author),
        labels: item.labels.nodes.map(mapGqlLabel),
        assignees: item.assignees.nodes.map(mapGqlAssignee),
        comments: item.comments.totalCount,
    };
}
