import {
    mapCbAssignee,
    mapCbAuthor,
    mapCbLabel,
    nullSafe,
} from "~/server/api/routers/mappers";
import {
    parseCodebergSearch,
    type SearchParams,
} from "~/server/api/routers/search-shared";
import { getCodebergToken } from "~/server/auth";
import {
    type CodebergPrListParams,
    type CodebergPullRequest,
    type CodebergPullRequestSort,
    listPullRequests,
} from "~/server/codeberg";
import type { Ctx, PullRequestProvider } from "./provider";
import type { PrSearchItem, PrSearchResult } from "./types";

export class CodebergPullRequestProvider implements PullRequestProvider {
    async search(params: SearchParams & { ctx: Ctx }): Promise<PrSearchResult> {
        const accessToken = await getCodebergToken(
            params.ctx.db,
            params.ctx.session?.user?.id,
        );

        const stateMatch = params.query.match(
            /^(is:open|is:closed|is:merged)\s*/,
        );
        const stateQualifier = stateMatch?.[1] ?? "is:open";
        const activeState = stateQualifier.replace("is:", "") as
            | "open"
            | "closed"
            | "merged";

        const { authorQualifier, labelQualifiers, cbSort, page, limit } =
            parseCodebergSearch(params);

        const prParams: CodebergPrListParams = {
            state: codebergState(activeState),
            sort: cbSort as CodebergPullRequestSort,
            page,
            limit,
        };
        if (authorQualifier) {
            prParams.author = authorQualifier;
        }
        if (labelQualifiers.length > 0) {
            prParams.labels = labelQualifiers;
        }

        const [result, openCount, closedCount] = await Promise.all([
            listPullRequests(accessToken, params.owner, params.repo, prParams),
            listPullRequests(accessToken, params.owner, params.repo, {
                state: "open",
                sort: cbSort as CodebergPullRequestSort,
                limit: 1,
                page: 1,
            }),
            listPullRequests(accessToken, params.owner, params.repo, {
                state: "closed",
                sort: cbSort as CodebergPullRequestSort,
                limit: 1,
                page: 1,
            }),
        ]);

        const hasNextPage =
            "hasNextPage" in result ? result.hasNextPage : false;

        return {
            items: result.items.map(mapCodebergPr),
            totalCount: result.totalCount,
            hasNextPage,
            endCursor: hasNextPage ? String(page + 1) : null,
            stateCounts: {
                open: openCount.totalCount,
                closed: closedCount.totalCount,
                merged: 0,
            },
        };
    }
}

function codebergState(state: string): "open" | "closed" | "all" {
    if (state === "merged") return "closed";
    if (state === "open") return "open";
    return "all";
}

function mapCodebergPr(pr: CodebergPullRequest): PrSearchItem {
    return {
        id: pr.id,
        number: pr.number,
        title: pr.title,
        state: pr.merged_at
            ? "MERGED"
            : (pr.state.toUpperCase() as PrSearchItem["state"]),
        isDraft: pr.draft,
        createdAt: pr.created_at,
        mergedAt: pr.merged_at,
        author: mapCbAuthor(pr.user),
        labels: nullSafe(pr.labels).map(mapCbLabel),
        assignees: nullSafe(pr.assignees).map(mapCbAssignee),
        comments: pr.comments ?? 0,
        reviewDecision: null,
        stack: null,
    };
}
