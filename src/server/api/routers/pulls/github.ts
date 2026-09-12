import { searchGqlItems } from "~/server/api/routers/github-search";
import { mapGqlPrSearchItem } from "~/server/api/routers/mappers";
import type { Ctx, SearchParams } from "~/server/api/routers/provider";
import { getGitHubToken } from "~/server/auth";
import {
    branchHasPullRequest,
    getCachedRepo,
    listRepoActivity,
} from "~/server/github";
import { searchPullRequestsWithStatus } from "~/server/github-graphql";
import type { PullRequestProvider } from "./provider";
import {
    bestEffortBanner,
    fromGitHubActivity,
    githubCompareUrl,
    PR_LOOKUP_LIMIT,
    type RecentlyPushedBranch,
    rankRecentPushes,
} from "./recent-push";
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
            itemKey: (item) => item.databaseId,
            sortValues: (item) => ({
                created: item.createdAt,
                updated: item.updatedAt,
                comments: item.comments.totalCount,
            }),
            mapItem: mapGqlPrSearchItem,
        });
    }
}

/**
 * Newest branch the viewer pushed to that still has no pull request, or null
 * when the repository has none. Drives the pull request list banner.
 *
 * Deletions are fetched separately because the actor-scoped feed would hide
 * a branch someone else (or an auto-delete) removed after the push.
 */
export function getGitHubRecentlyPushedBranch(
    accessToken: string,
    owner: string,
    repo: string,
    viewerLogin: string | null,
): Promise<RecentlyPushedBranch | null> {
    return bestEffortBanner(async () => {
        if (!viewerLogin) return null;

        const [repoData, pushes, deletions] = await Promise.all([
            getCachedRepo(accessToken, owner, repo),
            listRepoActivity(accessToken, owner, repo, {
                actor: viewerLogin,
            }),
            listRepoActivity(accessToken, owner, repo, {
                activityType: "branch_deletion",
            }),
        ]);
        const defaultBranch = repoData.default_branch;

        const ranked = rankRecentPushes(
            fromGitHubActivity([...pushes, ...deletions]),
            { viewerLogin, defaultBranch },
        ).slice(0, PR_LOOKUP_LIMIT);

        for (const match of ranked) {
            const taken = await branchHasPullRequest(
                accessToken,
                owner,
                repo,
                match.branch,
            );
            if (taken) continue;
            return {
                branch: match.branch,
                pushedAt: match.pushedAt,
                compareUrl: githubCompareUrl(
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
