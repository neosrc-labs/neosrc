import { z } from "zod";
import {
    findPendingReview,
    getGhToken,
    invalidatePrCache,
    prCommentIdInput,
    prTargetInput,
} from "~/server/api/routers/helpers";
import {
    createTRPCRouter,
    protectedMutation,
    protectedProcedure,
} from "~/server/api/trpc";
import { isAnonymousToken } from "~/server/auth";
import {
    applySuggestion,
    createPullRequestReviewComment,
    createStandaloneFileComment,
    createStandaloneReviewComment,
    deleteReviewComment,
    getAuthenticatedUser,
    getPullRequest,
    getPullRequestReviewComments,
    getPullRequestReviewCommentsForReview,
    getReviewThreads,
    getReviewThreadsPage,
    getSuggestionPatch,
    replyToPullRequestReviewComment,
    resolveReviewThread,
    unresolveReviewThread,
    updateReviewComment,
} from "~/server/github";

export const reviewCommentsRouter = createTRPCRouter({
    list: protectedProcedure
        .input(prTargetInput)
        .query(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            const comments = await getPullRequestReviewComments(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );

            return comments;
        }),

    byReviewId: protectedProcedure
        .input(prTargetInput.extend({ reviewId: z.number() }))
        .query(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            return getPullRequestReviewCommentsForReview(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.reviewId,
            );
        }),

    create: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                filePath: z.string(),
                lineNumber: z.number().optional(),
                side: z.enum(["LEFT", "RIGHT"]).optional(),
                startLineNumber: z.number().optional(),
                startSide: z.enum(["LEFT", "RIGHT"]).optional(),
                body: z.string().min(1),
                asReview: z.boolean().optional().default(false),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            const pr = await getPullRequest(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );

            if (input.lineNumber && input.side) {
                if (input.asReview) {
                    if (isAnonymousToken(accessToken)) {
                        throw new Error(
                            "Cannot create review comments without authentication",
                        );
                    }
                    const currentUser = await getAuthenticatedUser(accessToken);
                    const pendingReview = await findPendingReview(
                        accessToken,
                        input.owner,
                        input.repo,
                        input.number,
                        currentUser.login,
                    );

                    const comment = await createPullRequestReviewComment(
                        accessToken,
                        pr.node_id,
                        input.filePath,
                        input.lineNumber,
                        input.side,
                        input.body,
                        pendingReview?.node_id,
                        input.startLineNumber,
                        input.startSide,
                    );

                    await invalidatePrCache(
                        input.owner,
                        input.repo,
                        input.number,
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
                    input.startLineNumber,
                    input.startSide,
                );

                await invalidatePrCache(input.owner, input.repo, input.number);

                return { success: true as const, id: comment.id };
            }

            // File-level comment (no line number)
            const comment = await createStandaloneFileComment(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.body,
                pr.head.sha,
                input.filePath,
            );

            await invalidatePrCache(input.owner, input.repo, input.number);

            return { success: true as const, id: comment.id };
        }),

    update: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number().optional(),
                commentId: z.number(),
                body: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            await updateReviewComment(
                accessToken,
                input.owner,
                input.repo,
                input.commentId,
                input.body,
                input.number,
            );

            return { success: true as const };
        }),

    delete: protectedMutation
        .input(prCommentIdInput)
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            await deleteReviewComment(
                accessToken,
                input.owner,
                input.repo,
                input.commentId,
            );

            return { success: true as const };
        }),

    reply: protectedMutation
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
            const accessToken = await getGhToken(ctx);

            const comment = await replyToPullRequestReviewComment(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.body,
                input.inReplyTo,
            );

            await invalidatePrCache(input.owner, input.repo, input.number);

            return { success: true as const, id: comment.id };
        }),

    threads: protectedProcedure
        .input(prTargetInput)
        .query(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            return getReviewThreads(
                accessToken,
                input.owner,
                input.repo,
                input.number,
            );
        }),

    threadsPage: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                perPage: z.number().min(1).max(100).default(50),
                cursor: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            const result = await getReviewThreadsPage(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.perPage,
                input.cursor,
            );

            return {
                threads: result.threads,
                nextCursor: result.hasNextPage
                    ? (result.endCursor ?? undefined)
                    : undefined,
            };
        }),

    resolveThread: protectedMutation
        .input(
            z.object({
                threadId: z.string(),
                resolve: z.boolean(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            if (input.resolve) {
                await resolveReviewThread(accessToken, input.threadId);
            } else {
                await unresolveReviewThread(accessToken, input.threadId);
            }

            return { success: true as const, isResolved: input.resolve };
        }),

    applySuggestion: protectedMutation
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                path: z.string(),
                suggestionCode: z.string(),
                line: z.number().nullable().optional(),
                startLine: z.number().nullable().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            await applySuggestion(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.path,
                input.suggestionCode,
                input.line,
                input.startLine,
            );

            await invalidatePrCache(input.owner, input.repo, input.number);

            return { success: true as const };
        }),

    suggestionPatch: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                path: z.string(),
                suggestionCode: z.string(),
                line: z.number(),
                startLine: z.number().nullable().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGhToken(ctx);

            const patch = await getSuggestionPatch(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.path,
                input.suggestionCode,
                input.line,
                input.startLine,
            );

            return { patch };
        }),
});
