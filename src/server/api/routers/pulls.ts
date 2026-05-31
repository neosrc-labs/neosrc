import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getGitHubToken } from "~/server/auth";
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

            return listRepoAssignees(accessToken, input.owner, input.repo);
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

            return { success: true as const };
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
