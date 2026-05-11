import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { accounts } from "~/server/db/schema";
import {
	addAssigneesToIssue,
	addLabelsToIssue,
	addReviewersToPullRequest,
	createIssueComment,
	createPullRequestReview,
	listLabelsForRepo,
	listMilestonesForRepo,
	listRepoAssignees,
	removeAssigneesFromIssue,
	removeLabelFromIssue,
	removeReviewersFromPullRequest,
	updateIssueComment,
	updateIssueMilestone,
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

	updateComment: protectedProcedure
		.input(
			z.object({
				owner: z.string(),
				repo: z.string(),
				commentId: z.number(),
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

			const comment = await updateIssueComment(
				account.accessToken,
				input.owner,
				input.repo,
				input.commentId,
				input.body,
			);

			return { success: true as const, body: comment.body };
		}),

	listLabels: protectedProcedure
		.input(
			z.object({
				owner: z.string(),
				repo: z.string(),
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

			return listLabelsForRepo(account.accessToken, input.owner, input.repo);
		}),

	addLabel: protectedProcedure
		.input(
			z.object({
				owner: z.string(),
				repo: z.string(),
				number: z.number(),
				label: z.string(),
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

			await addLabelsToIssue(
				account.accessToken,
				input.owner,
				input.repo,
				input.number,
				[input.label],
			);

			return { success: true as const };
		}),

	removeLabel: protectedProcedure
		.input(
			z.object({
				owner: z.string(),
				repo: z.string(),
				number: z.number(),
				label: z.string(),
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

			await removeLabelFromIssue(
				account.accessToken,
				input.owner,
				input.repo,
				input.number,
				input.label,
			);

			return { success: true as const };
		}),

	listAssignees: protectedProcedure
		.input(
			z.object({
				owner: z.string(),
				repo: z.string(),
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

			return listRepoAssignees(account.accessToken, input.owner, input.repo);
		}),

	addAssignee: protectedProcedure
		.input(
			z.object({
				owner: z.string(),
				repo: z.string(),
				number: z.number(),
				assignee: z.string(),
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

			await addAssigneesToIssue(
				account.accessToken,
				input.owner,
				input.repo,
				input.number,
				[input.assignee],
			);

			return { success: true as const };
		}),

	removeAssignee: protectedProcedure
		.input(
			z.object({
				owner: z.string(),
				repo: z.string(),
				number: z.number(),
				assignee: z.string(),
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

			await removeAssigneesFromIssue(
				account.accessToken,
				input.owner,
				input.repo,
				input.number,
				[input.assignee],
			);

			return { success: true as const };
		}),

	listMilestones: protectedProcedure
		.input(
			z.object({
				owner: z.string(),
				repo: z.string(),
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

			return listMilestonesForRepo(account.accessToken, input.owner, input.repo);
		}),

	setMilestone: protectedProcedure
		.input(
			z.object({
				owner: z.string(),
				repo: z.string(),
				number: z.number(),
				milestone: z.number().nullable(),
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

			await updateIssueMilestone(
				account.accessToken,
				input.owner,
				input.repo,
				input.number,
				input.milestone,
			);

			return { success: true as const };
		}),

	addReviewer: protectedProcedure
		.input(
			z.object({
				owner: z.string(),
				repo: z.string(),
				number: z.number(),
				reviewer: z.string(),
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

			await addReviewersToPullRequest(
				account.accessToken,
				input.owner,
				input.repo,
				input.number,
				[input.reviewer],
			);

			return { success: true as const };
		}),

	removeReviewer: protectedProcedure
		.input(
			z.object({
				owner: z.string(),
				repo: z.string(),
				number: z.number(),
				reviewer: z.string(),
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

			await removeReviewersFromPullRequest(
				account.accessToken,
				input.owner,
				input.repo,
				input.number,
				[input.reviewer],
			);

			return { success: true as const };
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
