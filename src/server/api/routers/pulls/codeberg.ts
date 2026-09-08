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
    type CodebergPrListParams,
    type CodebergPullRequest,
    findPullRequestForBranches,
    getCachedRepo,
    listPullRequests,
    listRepoActivity,
} from "~/server/codeberg";
import type { PullRequestProvider } from "./provider";
import {
    bestEffortBanner,
    codebergCompareUrl,
    fromCodebergActivity,
    PR_LOOKUP_LIMIT,
    type RecentlyPushedBranch,
    rankRecentPushes,
} from "./recent-push";
import type { PrSearchItem, PrSearchResult } from "./types";

export class CodebergPullRequestProvider implements PullRequestProvider {
    async search(params: SearchParams & { ctx: Ctx }): Promise<PrSearchResult> {
        const accessToken = await getCodebergToken(
            params.ctx.db,
            params.ctx.session?.user?.id,
        );

        const qualifiers = parseForgejoQuery(params.query, {
            allowMerged: true,
        });
        const cbSort = resolveForgejoSort(params);
        const page = params.page ?? 1;
        const limit = params.first ?? 30;

        const prParams: CodebergPrListParams = {
            state: codebergState(qualifiers.activeState),
            sort: cbSort,
            page,
            limit,
        };
        if (qualifiers.author) {
            prParams.author = qualifiers.author;
        }
        if (qualifiers.labels.length > 0) {
            prParams.labels = qualifiers.labels;
        }

        const [result, counts] = await Promise.all([
            listPullRequests(accessToken, params.owner, params.repo, prParams),
            forgejoStateCounts(
                listPullRequests,
                accessToken,
                params.owner,
                params.repo,
                cbSort,
                { author: qualifiers.author, labels: qualifiers.labels },
            ),
        ]);

        return {
            items: result.items.map(mapCodebergPr),
            totalCount: result.totalCount,
            hasNextPage: result.hasNextPage ?? false,
            endCursor: result.hasNextPage ? String(page + 1) : null,
            stateCounts: { ...counts, merged: 0 },
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

/**
 * Newest branch the viewer pushed to that still has no pull request, or null
 * when the repository has none. Drives the pull request list banner.
 */
export function getCodebergRecentlyPushedBranch(
    accessToken: string,
    owner: string,
    repo: string,
    viewerLogin: string | null,
): Promise<RecentlyPushedBranch | null> {
    return bestEffortBanner(async () => {
        if (!viewerLogin) return null;

        const [repoData, activity] = await Promise.all([
            getCachedRepo(accessToken, owner, repo),
            listRepoActivity(accessToken, owner, repo),
        ]);
        const defaultBranch = repoData.default_branch;

        const ranked = rankRecentPushes(fromCodebergActivity(activity), {
            viewerLogin,
            defaultBranch,
        }).slice(0, PR_LOOKUP_LIMIT);

        for (const match of ranked) {
            if (defaultBranch) {
                const existing = await findPullRequestForBranches(
                    accessToken,
                    owner,
                    repo,
                    defaultBranch,
                    match.branch,
                );
                // Closed unmerged pull requests leave the branch proposable.
                if (existing?.state === "open" || existing?.merged) continue;
            }
            return {
                branch: match.branch,
                pushedAt: match.pushedAt,
                compareUrl: codebergCompareUrl(
                    owner,
                    repo,
                    match.branch,
                    defaultBranch,
                ),
            };
        }
        return null;
    });
}
