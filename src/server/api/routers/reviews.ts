import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { accounts } from "~/server/db/schema";
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
            const [account] = await ctx.db
                .select({ accessToken: accounts.access_token })
                .from(accounts)
                .where(eq(accounts.userId, ctx.session.user.id))
                .limit(1);

            if (!account?.accessToken) {
                throw new Error("GitHub account not connected");
            }

            const currentUser = await getAuthenticatedUser(account.accessToken);
            const githubLogin = currentUser.login;

            const reviews = await getPullRequestReviews(
                account.accessToken,
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
                account.accessToken,
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
            const [account] = await ctx.db
                .select({ accessToken: accounts.access_token })
                .from(accounts)
                .where(eq(accounts.userId, ctx.session.user.id))
                .limit(1);

            if (!account?.accessToken) {
                throw new Error("GitHub account not connected");
            }

            const currentUser = await getAuthenticatedUser(account.accessToken);
            const githubLogin = currentUser.login;

            const existing = await getPullRequestReviews(
                account.accessToken,
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
                account.accessToken,
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
            const [account] = await ctx.db
                .select({ accessToken: accounts.access_token })
                .from(accounts)
                .where(eq(accounts.userId, ctx.session.user.id))
                .limit(1);

            if (!account?.accessToken) {
                throw new Error("GitHub account not connected");
            }

            await submitPullRequestReview(
                account.accessToken,
                input.owner,
                input.repo,
                input.number,
                input.reviewId,
                input.event,
                input.body,
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
            const [account] = await ctx.db
                .select({ accessToken: accounts.access_token })
                .from(accounts)
                .where(eq(accounts.userId, ctx.session.user.id))
                .limit(1);

            if (!account?.accessToken) {
                throw new Error("GitHub account not connected");
            }

            await deletePendingReview(
                account.accessToken,
                input.owner,
                input.repo,
                input.number,
                input.reviewId,
            );

            return { success: true as const };
        }),
});
