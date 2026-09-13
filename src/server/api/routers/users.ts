import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
    getCodebergToken,
    getGitHubToken,
    getGithubUsername,
    isAnonymousToken,
} from "~/server/auth";
import {
    getUser as getCodebergUser,
    getUserByUsername as getCodebergUserByUsername,
} from "~/server/codeberg";
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
    currentUser: protectedProcedure
        .input(
            z
                .object({ provider: z.enum(["gh", "cb"]).default("gh") })
                .optional(),
        )
        .query(async ({ ctx, input }) => {
            const provider = input?.provider ?? "gh";

            if (provider === "cb") {
                const userId = ctx.session?.user?.id;
                // Anonymous visitors have no Codeberg account and the token
                // getter throws rather than returning an empty token.
                if (!userId) return null;

                try {
                    // Resolve the profile: the session image belongs to
                    // whichever provider signed in last, so it can carry a
                    // GitHub avatar for a Codeberg viewer.
                    const accessToken = await getCodebergToken(ctx.db, userId);
                    const user = await getCodebergUser(accessToken);
                    return user
                        ? { login: user.login, avatarUrl: user.avatar_url }
                        : null;
                } catch {
                    // No linked Codeberg account; treat the viewer as unknown.
                    return null;
                }
            }

            const githubUsername = ctx.session?.user?.githubUsername;
            const avatarUrl = ctx.session?.user?.image;

            if (githubUsername && avatarUrl) {
                return { login: githubUsername, avatarUrl };
            }

            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );
            if (isAnonymousToken(accessToken)) return null;
            const user = await getAuthenticatedUser(accessToken);

            return {
                login:
                    githubUsername ??
                    (await getGithubUsername(
                        ctx.session?.user?.id ?? null,
                        accessToken,
                    )),
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
                        ctx.session?.user?.id,
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
                    ctx.session?.user?.id,
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
                ctx.session?.user?.id,
            );

            const team = await getGitHubTeam(
                accessToken,
                input.org,
                input.teamSlug,
            );

            return { team };
        }),
});
