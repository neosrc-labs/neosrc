import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getGitHubToken } from "~/server/auth";
import { deleteCache, prCacheKey } from "~/server/cache";
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
    getPullRequestReviews,
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
                lineNumber: z.number().optional(),
                side: z.enum(["LEFT", "RIGHT"]).optional(),
                startLineNumber: z.number().optional(),
                startSide: z.enum(["LEFT", "RIGHT"]).optional(),
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

            if (input.lineNumber && input.side) {
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
                        input.startLineNumber,
                        input.startSide,
                    );

                    await deleteCache(
                        prCacheKey(input.owner, input.repo, input.number),
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

                await deleteCache(
                    prCacheKey(input.owner, input.repo, input.number),
                );

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

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
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

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
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
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

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

    resolveThread: protectedProcedure
        .input(
            z.object({
                threadId: z.string(),
                resolve: z.boolean(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            if (input.resolve) {
                await resolveReviewThread(accessToken, input.threadId);
            } else {
                await unresolveReviewThread(accessToken, input.threadId);
            }

            return { success: true as const, isResolved: input.resolve };
        }),

    applySuggestion: protectedProcedure
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
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

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

            await deleteCache(
                prCacheKey(input.owner, input.repo, input.number),
            );

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
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

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
