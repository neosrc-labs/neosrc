import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { accounts } from "~/server/db/schema";
import { getIssue, type IssueSearchItem, searchIssues } from "~/server/github";

export const issuesRouter = createTRPCRouter({
    getByNumber: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                issueNumber: z.number(),
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

            return getIssue(
                account.accessToken,
                input.owner,
                input.repo,
                input.issueNumber,
            );
        }),
    search: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                query: z.string(),
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

            const items: IssueSearchItem[] = await searchIssues(
                account.accessToken,
                input.owner,
                input.repo,
                input.query,
            );

            return items;
        }),
});
