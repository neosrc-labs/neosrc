import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getGitHubToken } from "~/server/auth";
import {
    createPullRequestReviewComment,
    createStandaloneReviewComment,
    deleteReviewComment,
    getAuthenticatedUser,
    getPullRequest,
    getPullRequestReviewComments,
    getPullRequestReviewCommentsForReview,
    getPullRequestReviews,
    getReviewThreads,
    replyToPullRequestReviewComment,
    updateReviewComment,
} from "~/server/github";

export const reviewCommentsRouter = createTRPCRouter({
    list: protectedProcedure
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

            const comments = await getPullRequestReviewComments(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );

            return comments;
        }),

    byReviewId: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                reviewId: z.number(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            return getPullRequestReviewCommentsForReview(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.reviewId,
            );
        }),

    create: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                filePath: z.string(),
                lineNumber: z.number(),
                side: z.enum(["LEFT", "RIGHT"]),
                body: z.string().min(1),
                asReview: z.boolean().optional().default(false),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const pr = await getPullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );

            if (input.asReview) {
                const currentUser = await getAuthenticatedUser(accessToken);
                const reviews = await getPullRequestReviews(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                );

                const pendingReview = reviews.find(
                    (r) =>
                        r.state === "PENDING" &&
                        r.user?.login === currentUser.login,
                );

                const comment = await createPullRequestReviewComment(
                    accessToken,
                    pr.node_id,
                    input.filePath,
                    input.lineNumber,
                    input.side,
                    input.body,
                    pendingReview?.node_id,
                );

                return { success: true as const, id: comment.id };
            }

            const comment = await createStandaloneReviewComment(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.body,
                pr.head.sha,
                input.filePath,
                input.lineNumber,
                input.side,
            );

            return { success: true as const, id: comment.id };
        }),

    update: protectedProcedure
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

            await updateReviewComment(
                accessToken,
                input.owner,
                input.repo,
                input.commentId,
                input.body,
            );

            return { success: true as const };
        }),

    delete: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                commentId: z.number(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            await deleteReviewComment(
                accessToken,
                input.owner,
                input.repo,
                input.commentId,
            );

            return { success: true as const };
        }),

    reply: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                body: z.string().min(1),
                inReplyTo: z.number(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const comment = await replyToPullRequestReviewComment(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.body,
                input.inReplyTo,
            );

            return { success: true as const, id: comment.id };
        }),

    threads: protectedProcedure
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

            return getReviewThreads(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );
        }),
});
