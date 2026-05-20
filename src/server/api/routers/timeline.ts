import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { accounts } from "~/server/db/schema";
import {
    getPullRequestTimelineGraphQL,
    type GQLTimelineEvent,
    type GQLReactionNode,
} from "~/server/github-graphql";

export type TimelineResult = {
    events: GQLTimelineEvent[];
    nextCursor: string | undefined;
    commentReactions: Record<
        number,
        {
            databaseId: number;
            content: string;
            createdAt: string;
            user: { login: string } | null;
        }[]
    >;
    currentUserLogin: string;
};

export const timelineRouter = createTRPCRouter({
    list: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                limit: z.number().min(1).max(100).default(30),
                cursor: z.string().optional(),
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

            const result = await getPullRequestTimelineGraphQL(
                account.accessToken,
                input.owner,
                input.repo,
                input.number,
                input.limit,
                input.cursor,
            );

            return {
                events: result.events,
                nextCursor: result.hasMore ? result.endCursor : undefined,
                commentReactions: result.commentReactions,
                currentUserLogin: result.currentUserLogin,
            } satisfies TimelineResult;
        }),
});
