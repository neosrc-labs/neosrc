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
import { searchPullRequestsWithStatus } from "~/server/github-graphql";
import type { Ctx, PullRequestProvider } from "./provider";
import type { PrSearchItem, PrSearchResult } from "./types";

export class GitHubPullRequestProvider implements PullRequestProvider {
    async search(params: SearchParams & { ctx: Ctx }): Promise<PrSearchResult> {
        const accessToken = await getGhToken(params.ctx);

        const result = await searchGithubWithCounts(
            accessToken,
            params,
            "pr",
            searchPullRequestsWithStatus,
            mapGqlItem,
        );

        return {
            ...result,
            stateCounts: {
                open: result.stateCounts.open,
                closed: result.stateCounts.closed,
                merged: result.stateCounts.merged ?? 0,
            },
        };
    }
}

function mapGqlItem(
    item: GqlSearchItemShape & {
        databaseId: number;
        number: number;
        title: string;
        state: string;
        isDraft: boolean;
        createdAt: string;
        mergedAt: string | null;
        reviewDecision: string | null;
        stack: { size: number; number: number } | null;
        stackEntry: { position: number } | null;
    },
): PrSearchItem {
    return {
        id: item.databaseId,
        number: item.number,
        title: item.title,
        state: item.state as PrSearchItem["state"],
        isDraft: item.isDraft,
        createdAt: item.createdAt,
        mergedAt: item.mergedAt,
        author: mapGqlAuthor(item.author),
        labels: item.labels.nodes.map(mapGqlLabel),
        assignees: item.assignees.nodes.map(mapGqlAssignee),
        comments: item.comments.totalCount,
        reviewDecision: item.reviewDecision,
        stack:
            item.stack && item.stackEntry
                ? {
                      size: item.stack.size,
                      position: item.stackEntry.position,
                      number: item.stack.number,
                  }
                : null,
    };
}
