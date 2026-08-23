import {
    forgejoStateCounts,
    parseForgejoQuery,
    resolveForgejoSort,
} from "~/server/api/routers/forgejo-search";
import {
    mapCbAssignee,
    mapCbAuthor,
    mapCbLabel,
    nullSafe,
} from "~/server/api/routers/mappers";
import type { Ctx, SearchParams } from "~/server/api/routers/provider";
import { getCodebergToken } from "~/server/auth";
import {
    type CodebergIssue,
    type CodebergIssueListParams,
    listIssues,
} from "~/server/codeberg";
import type { IssueProvider } from "./provider";
import type { IssueSearchItem, IssueSearchResult } from "./types";

export class CodebergIssueProvider implements IssueProvider {
    async search(
        params: SearchParams & { ctx: Ctx },
    ): Promise<IssueSearchResult> {
        const accessToken = await getCodebergToken(
            params.ctx.db,
            params.ctx.session?.user?.id,
        );

        const qualifiers = parseForgejoQuery(params.query, {
            allowMerged: false,
        });
        const cbSort = resolveForgejoSort(params);
        const page = params.page ?? 1;
        const limit = params.first ?? 30;

        const issueParams: CodebergIssueListParams = {
            state: qualifiers.activeState === "open" ? "open" : "closed",
            sort: cbSort,
            page,
            limit,
        };
        if (qualifiers.author) {
            issueParams.author = qualifiers.author;
        }
        if (qualifiers.labels.length > 0) {
            issueParams.labels = qualifiers.labels;
        }

        const [result, counts] = await Promise.all([
            listIssues(accessToken, params.owner, params.repo, issueParams),
            forgejoStateCounts(
                listIssues,
                accessToken,
                params.owner,
                params.repo,
                cbSort,
            ),
        ]);

        return {
            items: result.items.map(mapCodebergIssue),
            totalCount: result.totalCount,
            hasNextPage: result.hasNextPage ?? false,
            endCursor: result.hasNextPage ? String(page + 1) : null,
            stateCounts: counts,
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
