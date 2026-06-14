import { getCodebergToken } from "~/server/auth";
import {
    type CodebergPullRequest,
    type CodebergPullRequestSort,
    listPullRequests,
} from "~/server/codeberg";
import type { Ctx, PullRequestProvider } from "./provider";
import type { PrSearchItem, PrSearchResult, SearchParams } from "./types";

export class CodebergPullRequestProvider implements PullRequestProvider {
    async search(params: SearchParams & { ctx: Ctx }): Promise<PrSearchResult> {
        const accessToken = await getCodebergToken(
            params.ctx.db,
            params.ctx.session.user.id,
        );

        const stateMatch = params.query.match(
            /^(is:open|is:closed|is:merged)\s*/,
        );
        const stateQualifier = stateMatch?.[1] ?? "is:open";
        const activeState = stateQualifier.replace("is:", "") as
            | "open"
            | "closed"
            | "merged";

        const sortMap: Record<string, string | undefined> = {
            "created-desc": "newest",
            "created-asc": "oldest",
            "updated-desc": "recentupdate",
            "updated-asc": "leastupdate",
            "comments-desc": "mostcomment",
            "comments-asc": "leastcomment",
        };
        const sortKey =
            params.sort && params.order
                ? `${params.sort}-${params.order}`
                : "created-desc";
        const cbSort = sortMap[sortKey] ?? "newest";

        const page = params.page ?? 1;
        const limit = params.first ?? 30;

        const [result, openCount, closedCount] = await Promise.all([
            listPullRequests(accessToken, params.owner, params.repo, {
                state: codebergState(activeState),
                sort: cbSort as CodebergPullRequestSort,
                page,
                limit,
            }),
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

        return {
            items: result.items.map(mapCodebergPr),
            totalCount: result.totalCount,
            hasNextPage: result.hasNextPage ?? false,
            endCursor: result.hasNextPage ? String(page + 1) : null,
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
        author: pr.user
            ? {
                  login: pr.user.login,
                  avatarUrl: pr.user.avatar_url,
                  url: "",
              }
            : null,
        labels: (pr.labels ?? []).map((l) => ({
            id: String(l.id),
            name: l.name,
            color: l.color,
            description: l.description,
        })),
        assignees: (pr.assignees ?? []).map((a) => ({
            login: a.login,
            avatarUrl: a.avatar_url,
        })),
        comments: pr.comments ?? 0,
        reviewDecision: null,
    };
}
