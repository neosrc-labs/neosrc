import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { accounts } from "~/server/db/schema";
import { updatePullRequest } from "~/server/github";

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
});
