import {
    mapCbAssignee,
    mapCbAuthor,
    mapCbLabel,
    nullSafe,
} from "~/server/api/routers/mappers";
import { getCodebergToken } from "~/server/auth";
import {
    type CodebergIssue,
    type CodebergIssueListParams,
    type CodebergIssueSort,
    listIssues,
} from "~/server/codeberg";
import type { Ctx, IssueProvider } from "./provider";
import type { IssueSearchItem, IssueSearchResult, SearchParams } from "./types";

export class CodebergIssueProvider implements IssueProvider {
    async search(
        params: SearchParams & { ctx: Ctx },
    ): Promise<IssueSearchResult> {
        const accessToken = await getCodebergToken(
            params.ctx.db,
            params.ctx.session.user.id,
        );

        const stateMatch = params.query.match(/^(is:open|is:closed)\s*/);
        const stateQualifier = stateMatch?.[1] ?? "is:open";
        const activeState = stateQualifier.replace("is:", "") as
            | "open"
            | "closed";

        const authorMatch = params.query.match(/author:(\S+)/);
        const authorQualifier = authorMatch?.[1];

        const labelRegex = /label:\s*("[^"]*"|\S+)/g;
        const labelQualifiers: string[] = [];
        const allLabelMatches = params.query.matchAll(labelRegex);
        for (const m of allLabelMatches) {
            const name = (m[1] ?? "").replace(/^"|"$/g, "");
            if (name) labelQualifiers.push(name);
        }

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

        const issueParams: CodebergIssueListParams = {
            state: activeState === "open" ? "open" : "closed",
            sort: cbSort as CodebergIssueSort,
            page,
            limit,
        };
        if (authorQualifier) {
            issueParams.author = authorQualifier;
        }
        if (labelQualifiers.length > 0) {
            issueParams.labels = labelQualifiers;
        }

        const [result, openCount, closedCount] = await Promise.all([
            listIssues(accessToken, params.owner, params.repo, issueParams),
            listIssues(accessToken, params.owner, params.repo, {
                state: "open",
                sort: cbSort as CodebergIssueSort,
                limit: 1,
                page: 1,
            }),
            listIssues(accessToken, params.owner, params.repo, {
                state: "closed",
                sort: cbSort as CodebergIssueSort,
                limit: 1,
                page: 1,
            }),
        ]);

        return {
            items: result.items.map(mapCodebergIssue),
            totalCount: result.totalCount,
            hasNextPage: result.hasNextPage ?? false,
            endCursor: result.hasNextPage ? String(page + 1) : null,
            stateCounts: {
                open: openCount.totalCount,
                closed: closedCount.totalCount,
            },
        };
    }
}

function mapCodebergIssue(issue: CodebergIssue): IssueSearchItem {
    return {
        number: issue.number,
        title: issue.title,
        state: issue.state.toUpperCase() as IssueSearchItem["state"],
        createdAt: issue.created_at,
        closedAt: issue.closed_at,
        author: mapCbAuthor(issue.user),
        labels: nullSafe(issue.labels).map(mapCbLabel),
        assignees: nullSafe(issue.assignees).map(mapCbAssignee),
        comments: issue.comments ?? 0,
    };
}
