import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
    getCodebergToken,
    getGitHubToken,
    getGithubUsername,
} from "~/server/auth";
import { getUserByUsername as getCodebergUserByUsername } from "~/server/codeberg";
import {
    getAuthenticatedUser,
    getGitHubTeam,
    getGitHubUser,
} from "~/server/github";

export type UserProfile = {
    login: string;
    avatar_url: string;
    name?: string | null;
    bio?: string | null;
    company?: string | null;
    location?: string | null;
    blog?: string | null;
    twitter_username?: string | null;
    created_at?: string | null;
    followers?: number;
    following?: number;
};

export const usersRouter = createTRPCRouter({
    currentUser: protectedProcedure.query(async ({ ctx }) => {
        const { githubUsername, image: avatarUrl } = ctx.session.user;

        if (githubUsername && avatarUrl) {
            return { login: githubUsername, avatarUrl };
        }

        const accessToken = await getGitHubToken(ctx.db, ctx.session.user.id);
        const user = await getAuthenticatedUser(accessToken);

        return {
            login:
                githubUsername ??
                (await getGithubUsername(ctx.session.user.id, accessToken)),
            avatarUrl: avatarUrl ?? user.avatar_url,
        };
    }),
    getByUsername: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["gh", "cb"]).default("gh"),
                username: z.string(),
            }),
        )
        .query(
            async ({ ctx, input }): Promise<{ user: UserProfile | null }> => {
                if (input.provider === "cb") {
                    const accessToken = await getCodebergToken(
                        ctx.db,
                        ctx.session.user.id,
                    );
                    const raw = await getCodebergUserByUsername(
                        accessToken,
                        input.username,
                    );
                    if (!raw) return { user: null };
                    return {
                        user: {
                            login: raw.login,
                            avatar_url: raw.avatar_url,
                            name: raw.full_name || null,
                            bio: raw.description || null,
                            company: null,
                            location: raw.location || null,
                            blog: raw.website || null,
                            twitter_username: null,
                            created_at: raw.created_at || null,
                            followers: raw.followers_count,
                            following: raw.following_count,
                        },
                    };
                }

                const accessToken = await getGitHubToken(
                    ctx.db,
                    ctx.session.user.id,
                );

                const user = await getGitHubUser(accessToken, input.username);

                return { user };
            },
        ),
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
