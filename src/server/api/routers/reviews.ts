import { z } from "zod";

import {
    createTRPCRouter,
    protectedMutation,
    protectedProcedure,
} from "~/server/api/trpc";
import { getGitHubToken, isAnonymousToken } from "~/server/auth";
import { deleteCache, prCacheKey } from "~/server/cache";
import {
    type CommentForReview,
    createPullRequestReview,
    deletePendingReview,
    getAuthenticatedUser,
    getPullRequestReviewCommentsForReview,
    getPullRequestReviews,
    minimizePullRequestReview,
    type ReviewMinimizeClassifier,
    submitPullRequestReview,
    unminimizePullRequestReview,
} from "~/server/github";

export type PendingReview = {
    reviewId: number;
    comments: CommentForReview[];
};

export const reviewsRouter = createTRPCRouter({
    getPending: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
            }),
        )
        .query(async ({ ctx, input }): Promise<PendingReview | null> => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );
            if (isAnonymousToken(accessToken)) return null;
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

    start: protectedMutation
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
                ctx.session?.user?.id,
            );
            if (isAnonymousToken(accessToken)) return null;
            const currentUser = await getAuthenticatedUser(accessToken);

            const existing = await getPullRequestReviews(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );

            const existingPending = existing.find(
                (r) =>
                    r.state === "PENDING" &&
                    r.user?.login === currentUser.login,
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

    submit: protectedMutation
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
                ctx.session?.user?.id,
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

    dismiss: protectedMutation
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
                ctx.session?.user?.id,
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

    minimize: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                subjectId: z.string(),
                classifier: z.enum([
                    "OUTDATED",
                    "OFF_TOPIC",
                    "DUPLICATE",
                    "SPAM",
                    "ABUSE",
                ]),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            await minimizePullRequestReview(
                accessToken,
                input.subjectId,
                input.classifier satisfies ReviewMinimizeClassifier,
            );

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),

    unminimize: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                subjectId: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            await unminimizePullRequestReview(accessToken, input.subjectId);

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

            return { success: true as const };
        }),
});
