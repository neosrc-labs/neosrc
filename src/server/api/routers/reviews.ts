import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getGitHubToken } from "~/server/auth";
import { deleteCache, prCacheKey } from "~/server/cache";
import {
    createPullRequestReview,
    deletePendingReview,
    getAuthenticatedUser,
    getPullRequestReviewCommentsForReview,
    getPullRequestReviews,
    submitPullRequestReview,
} from "~/server/github";

export const reviewsRouter = createTRPCRouter({
    getPending: protectedProcedure
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

            const currentUser = await getAuthenticatedUser(accessToken);
            const githubLogin = currentUser.login;

            const reviews = await getPullRequestReviews(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );

            const pendingReview = reviews.find(
                (r) => r.state === "PENDING" && r.user?.login === githubLogin,
            );

            if (!pendingReview) {
                return null;
            }

            const comments = await getPullRequestReviewCommentsForReview(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                pendingReview.id,
            );

            return {
                reviewId: pendingReview.id,
                comments,
            };
        }),

    start: protectedProcedure
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

            const currentUser = await getAuthenticatedUser(accessToken);
            const githubLogin = currentUser.login;

            const existing = await getPullRequestReviews(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );

            const existingPending = existing.find(
                (r) => r.state === "PENDING" && r.user?.login === githubLogin,
            );

            if (existingPending) {
                return { reviewId: existingPending.id };
            }

            const review = await createPullRequestReview(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );

            return { reviewId: review.id };
        }),

    submit: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                reviewId: z.number(),
                event: z.enum(["APPROVE", "COMMENT", "REQUEST_CHANGES"]),
                body: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            await submitPullRequestReview(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.reviewId,
                input.event,
                input.body,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    dismiss: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                reviewId: z.number(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            await deletePendingReview(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.reviewId,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),
});
