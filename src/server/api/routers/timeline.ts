import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { accounts } from "~/server/db/schema";
import {
	getPullRequestTimeline,
	type TimelineEventData,
} from "~/server/github";

export type TimelineResult = {
	events: TimelineEventData[];
	nextCursor: number | undefined;
};

export const timelineRouter = createTRPCRouter({
	list: protectedProcedure
		.input(
			z.object({
				owner: z.string(),
				repo: z.string(),
				number: z.number(),
				limit: z.number().min(1).max(100).default(30),
				cursor: z.number().optional(),
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

			const page = input.cursor ?? 1;
			const result = await getPullRequestTimeline(
				account.accessToken,
				input.owner,
				input.repo,
				input.number,
				page,
				input.limit,
			);

			const response: TimelineResult = {
				events: result.events,
				nextCursor: result.hasMore ? result.nextPage : undefined,
			};

			return response;
		}),
});
