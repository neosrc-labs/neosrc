import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getGitHubToken } from "~/server/auth";
import {
    createIssueCommentReaction,
    createIssueReaction,
    createPullRequestReviewCommentReaction,
    deleteIssueCommentReaction,
    deleteIssueReaction,
    deletePullRequestReviewCommentReaction,
    getAuthenticatedUser,
    getIssueCommentReactions,
    getPullRequestReactions,
    getPullRequestReviewCommentReactions,
} from "~/server/github";
import {
    addReaction,
    getSubjectReactions,
    removeReaction,
} from "~/server/github-graphql";

export const reactionsRouter = createTRPCRouter({
    get: protectedProcedure
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

            const [currentUser, reactions] = await Promise.all([
                getAuthenticatedUser(accessToken),
                getPullRequestReactions(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                ),
            ]);

            return { reactions, currentUserLogin: currentUser.login };
        }),

    toggleIssueComment: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                commentId: z.number(),
                content: z.enum([
                    "+1",
                    "-1",
                    "laugh",
                    "confused",
                    "heart",
                    "hooray",
                    "rocket",
                    "eyes",
                ]),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const [currentUser, existingReactions] = await Promise.all([
                getAuthenticatedUser(accessToken),
                getIssueCommentReactions(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.commentId,
                ),
            ]);

            const existing = existingReactions.find(
                (r) =>
                    r.user?.login === currentUser.login &&
                    r.content === input.content,
            );

            if (existing) {
                await deleteIssueCommentReaction(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.commentId,
                    existing.id,
                );
                return { action: "removed" as const };
            }

            await createIssueCommentReaction(
                accessToken,
                input.owner,
                input.repo,
                input.commentId,
                input.content,
            );
            return { action: "added" as const };
        }),

    togglePullRequestReviewComment: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                commentId: z.number(),
                content: z.enum([
                    "+1",
                    "-1",
                    "laugh",
                    "confused",
                    "heart",
                    "hooray",
                    "rocket",
                    "eyes",
                ]),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const [currentUser, existingReactions] = await Promise.all([
                getAuthenticatedUser(accessToken),
                getPullRequestReviewCommentReactions(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.commentId,
                ),
            ]);

            const existing = existingReactions.find(
                (r) =>
                    r.user?.login === currentUser.login &&
                    r.content === input.content,
            );

            if (existing) {
                await deletePullRequestReviewCommentReaction(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.commentId,
                    existing.id,
                );
                return { action: "removed" as const };
            }

            await createPullRequestReviewCommentReaction(
                accessToken,
                input.owner,
                input.repo,
                input.commentId,
                input.content,
            );
            return { action: "added" as const };
        }),

    togglePullRequestReview: protectedProcedure
        .input(
            z.object({
                subjectId: z.string(),
                content: z.enum([
                    "+1",
                    "-1",
                    "laugh",
                    "confused",
                    "heart",
                    "hooray",
                    "rocket",
                    "eyes",
                ]),
                databaseId: z.number().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const [currentUser, existingReactions] = await Promise.all([
                getAuthenticatedUser(accessToken),
                getSubjectReactions(accessToken, input.subjectId),
            ]);

            const existing = existingReactions.find(
                (r) =>
                    r.user?.login === currentUser.login &&
                    r.content === input.content,
            );

            if (existing) {
                await removeReaction(
                    accessToken,
                    input.subjectId,
                    input.content,
                );
                return { action: "removed" as const };
            }

            await addReaction(accessToken, input.subjectId, input.content);
            return { action: "added" as const };
        }),

    getForReviewComments: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                commentIds: z.array(z.number()),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const token = accessToken;

            const results = await Promise.all(
                input.commentIds.map((commentId) =>
                    getPullRequestReviewCommentReactions(
                        token,
                        input.owner,
                        input.repo,
                        commentId,
                    ).catch(() => []),
                ),
            );

            const reactionMap: Record<
                number,
                Awaited<ReturnType<typeof getPullRequestReviewCommentReactions>>
            > = {};
            input.commentIds.forEach((id, i) => {
                reactionMap[id] = results[i] as Awaited<
                    ReturnType<typeof getPullRequestReviewCommentReactions>
                >;
            });

            return reactionMap;
        }),

    toggleIssue: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                content: z.enum([
                    "+1",
                    "-1",
                    "laugh",
                    "confused",
                    "heart",
                    "hooray",
                    "rocket",
                    "eyes",
                ]),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const [currentUser, existingReactions] = await Promise.all([
                getAuthenticatedUser(accessToken),
                getPullRequestReactions(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                ),
            ]);

            const existing = existingReactions.find(
                (r) =>
                    r.user?.login === currentUser.login &&
                    r.content === input.content,
            );

            if (existing) {
                await deleteIssueReaction(
                    accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                    existing.id,
                );
                return { action: "removed" as const };
            }

            await createIssueReaction(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.content,
            );
            return { action: "added" as const };
        }),
});
