import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { accounts } from "~/server/db/schema";
import { getGitHubUser } from "~/server/github";

export const usersRouter = createTRPCRouter({
	getByUsername: protectedProcedure
		.input(
			z.object({
				username: z.string(),
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

			const user = await getGitHubUser(account.accessToken, input.username);

			return { user };
		}),
});
