import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getGitHubToken } from "~/server/auth";
import {
    getAuthenticatedUser,
    getGitHubTeam,
    getGitHubUser,
} from "~/server/github";

export const usersRouter = createTRPCRouter({
    currentUser: protectedProcedure.query(async ({ ctx }) => {
        const accessToken = await getGitHubToken(ctx.db, ctx.session.user.id);

        const user = await getAuthenticatedUser(accessToken);
        return { login: user.login };
    }),
    getByUsername: protectedProcedure
        .input(
            z.object({
                username: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const user = await getGitHubUser(accessToken, input.username);

            return { user };
        }),
    getByTeamSlug: protectedProcedure
        .input(
            z.object({
                org: z.string(),
                teamSlug: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session.user.id,
            );

            const team = await getGitHubTeam(
                accessToken,
                input.org,
                input.teamSlug,
            );

            return { team };
        }),
});
