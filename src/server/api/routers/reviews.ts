import { z } from "zod";
import {
    findPendingReview,
    getCurrentUserOrNull,
    getGhToken,
    invalidatePrCache,
    prTargetInput,
    reviewEventInput,
} from "~/server/api/routers/helpers";
import {
    createTRPCRouter,
    protectedMutation,
    protectedProcedure,
} from "~/server/api/trpc";
import {
    type CommentForReview,
    createPullRequestReview,
    deletePendingReview,
    getPullRequestReviewCommentsForReview,
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
        .input(prTargetInput)
        .query(async ({ ctx, input }): Promise<PendingReview | null> => {
            const accessToken = await getGhToken(ctx);
            const currentUser = await getCurrentUserOrNull(accessToken);
            if (!currentUser) return null;

            const pendingReview = await findPendingReview(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                currentUser.login,
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
        .input(prTargetInput)
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);
            const currentUser = await getCurrentUserOrNull(accessToken);
            if (!currentUser) return null;

            const existingPending = await findPendingReview(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                currentUser.login,
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
        .input(reviewEventInput.extend({ reviewId: z.number() }))
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            await submitPullRequestReview(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.reviewId,
                input.event,
                input.body,
            );

            await invalidatePrCache(input.owner, input.repo, input.number);

            return { success: true as const };
        }),

    dismiss: protectedMutation
        .input(prTargetInput.extend({ reviewId: z.number() }))
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            await deletePendingReview(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.reviewId,
            );

            await invalidatePrCache(input.owner, input.repo, input.number);

            return { success: true as const };
        }),

    minimize: protectedMutation
        .input(
            prTargetInput.extend({
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
            const accessToken = await getGhToken(ctx);

            await minimizePullRequestReview(
                accessToken,
                input.subjectId,
                input.classifier satisfies ReviewMinimizeClassifier,
            );

            await invalidatePrCache(input.owner, input.repo, input.number);

            return { success: true as const };
        }),

    unminimize: protectedMutation
        .input(prTargetInput.extend({ subjectId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            await unminimizePullRequestReview(accessToken, input.subjectId);

            await invalidatePrCache(input.owner, input.repo, input.number);

            return { success: true as const };
        }),
});
