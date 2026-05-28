import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { accounts } from "~/server/db/schema";
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
import { addReaction, removeReaction } from "~/server/github-graphql";

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
            const [account] = await ctx.db
                .select({ accessToken: accounts.access_token })
                .from(accounts)
                .where(eq(accounts.userId, ctx.session.user.id))
                .limit(1);

            if (!account?.accessToken) {
                throw new Error("GitHub account not connected");
            }

            const [currentUser, reactions] = await Promise.all([
                getAuthenticatedUser(account.accessToken),
                getPullRequestReactions(
                    account.accessToken,
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
            const [account] = await ctx.db
                .select({ accessToken: accounts.access_token })
                .from(accounts)
                .where(eq(accounts.userId, ctx.session.user.id))
                .limit(1);

            if (!account?.accessToken) {
                throw new Error("GitHub account not connected");
            }

            const [currentUser, existingReactions] = await Promise.all([
                getAuthenticatedUser(account.accessToken),
                getIssueCommentReactions(
                    account.accessToken,
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
                    account.accessToken,
                    input.owner,
                    input.repo,
                    input.commentId,
                    existing.id,
                );
                return { action: "removed" as const };
            }

            await createIssueCommentReaction(
                account.accessToken,
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
            const [account] = await ctx.db
                .select({ accessToken: accounts.access_token })
                .from(accounts)
                .where(eq(accounts.userId, ctx.session.user.id))
                .limit(1);

            if (!account?.accessToken) {
                throw new Error("GitHub account not connected");
            }

            const [currentUser, existingReactions] = await Promise.all([
                getAuthenticatedUser(account.accessToken),
                getPullRequestReviewCommentReactions(
                    account.accessToken,
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
                    account.accessToken,
                    input.owner,
                    input.repo,
                    input.commentId,
                    existing.id,
                );
                return { action: "removed" as const };
            }

            await createPullRequestReviewCommentReaction(
                account.accessToken,
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

            try {
                await addReaction(
                    account.accessToken,
                    input.subjectId,
                    input.content,
                );
                return { action: "added" as const };
            } catch {
                await removeReaction(
                    account.accessToken,
                    input.subjectId,
                    input.content,
                );
                return { action: "removed" as const };
            }
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
            const [account] = await ctx.db
                .select({ accessToken: accounts.access_token })
                .from(accounts)
                .where(eq(accounts.userId, ctx.session.user.id))
                .limit(1);

            if (!account?.accessToken) {
                throw new Error("GitHub account not connected");
            }

            const token = account.accessToken;

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
            const [account] = await ctx.db
                .select({ accessToken: accounts.access_token })
                .from(accounts)
                .where(eq(accounts.userId, ctx.session.user.id))
                .limit(1);

            if (!account?.accessToken) {
                throw new Error("GitHub account not connected");
            }

            const [currentUser, existingReactions] = await Promise.all([
                getAuthenticatedUser(account.accessToken),
                getPullRequestReactions(
                    account.accessToken,
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
                    account.accessToken,
                    input.owner,
                    input.repo,
                    input.number,
                    existing.id,
                );
                return { action: "removed" as const };
            }

            await createIssueReaction(
                account.accessToken,
                input.owner,
                input.repo,
                input.number,
                input.content,
            );
            return { action: "added" as const };
        }),
});
