import { eq } from "drizzle-orm";
import { z } from "zod";

import {
	createTRPCRouter,
	protectedProcedure,
} from "~/server/api/trpc";
import { accounts } from "~/server/db/schema";
import { createOctokit, getPullRequestReactions } from "~/server/github";

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

			const octokit = createOctokit(account.accessToken);
			const reactions = await getPullRequestReactions(
				octokit,
				input.owner,
				input.repo,
				input.number,
			);

			return { reactions };
		}),
});
