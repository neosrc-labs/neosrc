import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { accounts } from "~/server/db/schema";
import {
	createIssueComment,
	createPullRequestReview,
	updatePullRequest,
} from "~/server/github";

export const pullsRouter = createTRPCRouter({
	updateBody: protectedProcedure
		.input(
			z.object({
				owner: z.string(),
				repo: z.string(),
				number: z.number(),
				body: z.string(),
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

			const result = await updatePullRequest(
				account.accessToken,
				input.owner,
				input.repo,
				input.number,
				input.body,
			);

			return { success: true as const, body: result.body };
		}),

	addComment: protectedProcedure
		.input(
			z.object({
				owner: z.string(),
				repo: z.string(),
				number: z.number(),
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

			const comment = await createIssueComment(
				account.accessToken,
				input.owner,
				input.repo,
				input.number,
				input.body,
			);

			return { success: true as const, id: comment.id };
		}),

	approve: protectedProcedure
		.input(
			z.object({
				owner: z.string(),
				repo: z.string(),
				number: z.number(),
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

			const review = await createPullRequestReview(
				account.accessToken,
				input.owner,
				input.repo,
				input.number,
				input.event,
				input.body,
			);

			return { success: true as const, id: review.id };
		}),
});
