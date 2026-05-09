import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { accounts } from "~/server/db/schema";
import {
	createPullRequestReviewComment,
	getPullRequest,
	getPullRequestReviewComments,
	replyToPullRequestReviewComment,
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
			const [account] = await ctx.db
				.select({ accessToken: accounts.access_token })
				.from(accounts)
				.where(eq(accounts.userId, ctx.session.user.id))
				.limit(1);

			if (!account?.accessToken) {
				throw new Error("GitHub account not connected");
			}

			const comments = await getPullRequestReviewComments(
				account.accessToken,
				input.owner,
				input.repo,
				input.number,
			);

			return comments;
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

			const pr = await getPullRequest(
				account.accessToken,
				input.owner,
				input.repo,
				input.number,
			);

			const commitId = pr.head.sha;

			const comment = await createPullRequestReviewComment(
				account.accessToken,
				input.owner,
				input.repo,
				input.number,
				commitId,
				input.filePath,
				input.lineNumber,
				input.side,
				input.body,
			);

			return { success: true as const, id: comment.id };
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
			const [account] = await ctx.db
				.select({ accessToken: accounts.access_token })
				.from(accounts)
				.where(eq(accounts.userId, ctx.session.user.id))
				.limit(1);

			if (!account?.accessToken) {
				throw new Error("GitHub account not connected");
			}

			const comment = await replyToPullRequestReviewComment(
				account.accessToken,
				input.owner,
				input.repo,
				input.number,
				input.body,
				input.inReplyTo,
			);

			return { success: true as const, id: comment.id };
		}),
});
