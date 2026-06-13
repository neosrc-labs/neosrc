import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getCodebergToken, getGitHubToken } from "~/server/auth";
import { deleteCache, prCacheKey } from "~/server/cache";
import {
    type CodebergPullRequest,
    type CodebergPullRequestSort,
    listPullRequests as listCodebergPullRequests,
} from "~/server/codeberg";
import type { db } from "~/server/db";
import {
    addAssigneesToIssue,
    addLabelsToIssue,
    addReviewersToPullRequest,
    closePullRequest,
    createIssueComment,
    createPullRequestReview,
    getPullRequestReviews,
    listLabelsForRepo,
    listMilestonesForRepo,
    listPullRequests,
    listRecentIssueAuthors,
    listRepoAssignees,
    markPullRequestAsDraft,
    markPullRequestAsReady,
    mergePullRequest,
    removeAssigneesFromIssue,
    removeLabelFromIssue,
    removeReviewersFromPullRequest,
    reopenPullRequest,
    updateIssueComment,
    updateIssueMilestone,
    updatePullRequest,
    updatePullRequestReview,
} from "~/server/github";
import type { GqlPrSearchItem } from "~/server/github-graphql";
import { searchPullRequestsWithStatus } from "~/server/github-graphql";

function codebergState(state: string): "open" | "closed" | "all" {
    if (state === "merged") return "closed";
    if (state === "open") return "open";
    return "all";
}

function codebergPrToSearchItem(pr: CodebergPullRequest): GqlPrSearchItem {
    return {
        databaseId: pr.id,
        number: pr.number,
        title: pr.title,
        state: pr.merged_at ? "MERGED" : pr.state.toUpperCase(),
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
        labels: {
            nodes: (pr.labels ?? []).map((l) => ({
                id: String(l.id),
                name: l.name,
                color: l.color,
                description: l.description,
            })),
        },
        assignees: {
            nodes: (pr.assignees ?? []).map((a) => ({
                login: a.login,
                avatarUrl: a.avatar_url,
            })),
        },
        comments: { totalCount: pr.comments ?? 0 },
        reviewDecision: null,
    };
}

async function searchCodebergPullRequests(
    ctx: {
        db: typeof db;
        session: { user: { id: string } };
    },
    input: {
        owner: string;
        repo: string;
        query: string;
        page?: number;
        first?: number;
        sort?: "created" | "updated" | "comments";
        order?: "asc" | "desc";
    },
) {
    const accessToken = await getCodebergToken(ctx.db, ctx.session.user.id);

    const stateMatch = input.query.match(/^(is:open|is:closed|is:merged)\s*/);
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
        input.sort && input.order
            ? `${input.sort}-${input.order}`
            : "created-desc";
    const cbSort = sortMap[sortKey] ?? "newest";

    const page = input.page ?? 1;
    const limit = input.first ?? 30;

    const [result, openCount, closedCount] = await Promise.all([
        listCodebergPullRequests(accessToken, input.owner, input.repo, {
            state: codebergState(activeState),
            sort: cbSort as CodebergPullRequestSort,
            page,
            limit,
        }),
        listCodebergPullRequests(accessToken, input.owner, input.repo, {
            state: "open",
            sort: cbSort as CodebergPullRequestSort,
            limit: 1,
            page: 1,
        }),
        listCodebergPullRequests(accessToken, input.owner, input.repo, {
            state: "closed",
            sort: cbSort as CodebergPullRequestSort,
            limit: 1,
            page: 1,
        }),
    ]);

    const items = result.items.map(codebergPrToSearchItem);

    return {
        items,
        totalCount: result.totalCount,
        hasNextPage: result.hasNextPage,
        endCursor: result.hasNextPage ? String(page + 1) : null,
        stateCounts: {
            open: openCount.totalCount,
            closed: closedCount.totalCount,
            merged: 0,
        },
    };
}

export const pullsRouter = createTRPCRouter({
    updateBody: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                body: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const result = await updatePullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.body,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const, body: result.body };
        }),

    addComment: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                body: z.string().min(1),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const comment = await createIssueComment(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.body,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const, id: comment.id };
        }),

    updateComment: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                commentId: z.number(),
                body: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const comment = await updateIssueComment(
                accessToken,
                input.owner,
                input.repo,
                input.commentId,
                input.body,
            );

            return { success: true as const, body: comment.body };
        }),

    updateReview: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                reviewId: z.number(),
                body: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const review = await updatePullRequestReview(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.reviewId,
                input.body,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const, body: review.body };
        }),

    listLabels: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            return listLabelsForRepo(accessToken, input.owner, input.repo);
        }),

    addLabel: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                label: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            await addLabelsToIssue(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                [input.label],
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    removeLabel: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                label: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            await removeLabelFromIssue(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.label,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    listAssignees: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );
            console.log({ accessToken })

            return listRepoAssignees(accessToken, input.owner, input.repo);
        }),

    listRecentAuthors: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            return listRecentIssueAuthors(accessToken, input.owner, input.repo);
        }),

    addAssignee: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                assignee: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            await addAssigneesToIssue(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                [input.assignee],
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    removeAssignee: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                assignee: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            await removeAssigneesFromIssue(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                [input.assignee],
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    listMilestones: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            return listMilestonesForRepo(accessToken, input.owner, input.repo);
        }),

    setMilestone: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                milestone: z.number().nullable(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            await updateIssueMilestone(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.milestone,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    addReviewer: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                reviewer: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            await addReviewersToPullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                [input.reviewer],
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    removeReviewer: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                reviewer: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            await removeReviewersFromPullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                [input.reviewer],
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    approve: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                event: z.enum(["APPROVE", "COMMENT", "REQUEST_CHANGES"]),
                body: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const review = await createPullRequestReview(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.event,
                input.body,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const, id: review.id };
        }),

    markAsDraft: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            await markPullRequestAsDraft(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    markReadyForReview: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            await markPullRequestAsReady(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    merge: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                mergeMethod: z.enum(["merge", "squash", "rebase"]),
                commitTitle: z.string().optional(),
                commitMessage: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const result = await mergePullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.mergeMethod,
                input.commitTitle,
                input.commitMessage,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return {
                success: true as const,
                sha: result.sha,
                merged: result.merged,
            };
        }),

    close: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            await closePullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    reopen: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            await reopenPullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    list: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                state: z.enum(["open", "closed", "all"]).default("open"),
                page: z.number().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            return listPullRequests(
                accessToken,
                input.owner,
                input.repo,
                input.state,
                input.page,
            );
        }),

    search: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
                query: z.string(),
                page: z.number().optional(),
                after: z.string().optional(),
                first: z.number().optional(),
                sort: z.enum(["created", "updated", "comments"]).optional(),
                order: z.enum(["asc", "desc"]).optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                return searchCodebergPullRequests(ctx, input);
            }

            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            // Build GraphQL search query with repo + sort qualifiers
            const sortOrder =
                input.sort && input.order
                    ? ` sort:${input.sort}-${input.order}`
                    : "";
            const gqlQuery = `repo:${input.owner}/${input.repo} is:pr ${input.query}${sortOrder}`;

            // Extract the base query (without state qualifier) to build count queries
            const restQuery = input.query.replace(
                /^(is:open|is:closed|is:merged)\s*/,
                "",
            );
            const base = `repo:${input.owner}/${input.repo} is:pr`;
            const countQueries = {
                open: `${base} is:open ${restQuery}`.trim(),
                closed: `${base} is:closed ${restQuery}`.trim(),
                merged: `${base} is:merged ${restQuery}`.trim(),
            };

            const result = await searchPullRequestsWithStatus(
                accessToken,
                gqlQuery,
                input.first ?? 30,
                input.after ?? null,
                countQueries,
            );

            return result;
        }),

    listReviews: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            return getPullRequestReviews(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );
        }),
});
