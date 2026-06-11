import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getGitHubToken } from "~/server/auth";
import {
    type GQLMergeQueueEntry,
    type GQLTimelineEvent,
    getPullRequestTimelineGraphQL,
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
    mergeQueueEntry: GQLMergeQueueEntry;
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
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const result = await getPullRequestTimelineGraphQL(
                accessToken,
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
                mergeQueueEntry: result.mergeQueueEntry,
            } satisfies TimelineResult;
        }),
});
