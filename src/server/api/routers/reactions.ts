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
					r.user?.login === currentUser.login && r.content === input.content,
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
					r.user?.login === currentUser.login && r.content === input.content,
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
					r.user?.login === currentUser.login && r.content === input.content,
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
