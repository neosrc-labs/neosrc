import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getCodebergToken, getGitHubToken } from "~/server/auth";
import { deleteCache, prCacheKey } from "~/server/cache";
import {
    listAssignees as listCodebergAssignees,
    listLabels as listCodebergLabels,
    listMilestones as listCodebergMilestones,
    listRecentIssueAuthors as listCodebergRecentAuthors,
} from "~/server/codeberg";
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
    revertPullRequest,
    updateIssueComment,
    updateIssueMilestone,
    updatePullRequest,
    updatePullRequestReview,
} from "~/server/github";
import { CodebergPullRequestProvider } from "./codeberg";
import { GitHubPullRequestProvider } from "./github";
import type { Ctx } from "./provider";
import type { PrSearchResult } from "./types";

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
                { body: input.body },
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const, body: result.body };
        }),

    updateTitle: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                title: z.string(),
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
                { title: input.title },
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const, title: result.title };
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
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
                return listCodebergLabels(accessToken, input.owner, input.repo);
            }

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
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
                return listCodebergAssignees(
                    accessToken,
                    input.owner,
                    input.repo,
                );
            }

            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            return listRepoAssignees(accessToken, input.owner, input.repo);
        }),

    listRecentAuthors: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
                return listCodebergRecentAuthors(
                    accessToken,
                    input.owner,
                    input.repo,
                );
            }

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
                provider: z.enum(["gh", "cb"]).default("gh"),
                owner: z.string(),
                repo: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            if (input.provider === "cb") {
                const accessToken = await getCodebergToken(
                    ctx.db,
                    ctx.session.user.id,
                );
                return listCodebergMilestones(
                    accessToken,
                    input.owner,
                    input.repo,
                );
            }

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

    revert: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                title: z.string().optional(),
                body: z.string().optional(),
                draft: z.boolean().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const result = await revertPullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.title,
                input.body,
                input.draft,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return {
                success: true as const,
                revertPullRequest: {
                    number: result.number,
                    url: result.url,
                },
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
        .query(async ({ ctx, input }): Promise<PrSearchResult> => {
            const providerCtx: Ctx = {
                db: ctx.db,
                session: ctx.session,
            };

            const provider =
                input.provider === "cb"
                    ? new CodebergPullRequestProvider()
                    : new GitHubPullRequestProvider();

            return provider.search({
                ...input,
                ctx: providerCtx,
            });
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
