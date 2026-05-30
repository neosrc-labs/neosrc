import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { env } from "~/env";
import { db } from "~/server/db";
import {
    betterAuthAccount,
    betterAuthSession,
    betterAuthUser,
    betterAuthVerification,
} from "~/server/db/schema";

const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

async function refreshGitHubToken(refreshToken: string) {
    const res = await fetch(GITHUB_TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
        }),
    });

    const refreshed = await res.json();

    if (!res.ok || refreshed.error) {
        throw new Error(
            refreshed.error_description ?? "Failed to refresh token",
        );
    }

    return refreshed as {
        access_token: string;
        expires_in: number;
        refresh_token: string;
        refresh_token_expires_in: number;
    };
}

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user: betterAuthUser,
            session: betterAuthSession,
            account: betterAuthAccount,
            verification: betterAuthVerification,
        },
    }),
    socialProviders: {
        github: {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
            scope: [
                "read:user",
                "user:email",
                "repo",
                "public_repo",
                "read:project",
                "read:org",
                "read:discussion",
            ],
            redirectURI: `${env.BETTER_AUTH_URL}/api/auth/callback/github`,
        },
    },
    plugins: [nextCookies()],
});

export const getSession = cache(async () =>
    auth.api.getSession({ headers: await headers() }),
);

export const githubAccessToken = async () => {
    const session = await getSession();
    if (!session?.user?.id) return null;

    const [account] = await db
        .select()
        .from(betterAuthAccount)
        .where(eq(betterAuthAccount.userId, session.user.id))
        .limit(1);

    if (!account) return null;

    const now = Date.now();
    const expiresAt = account.accessTokenExpiresAt?.getTime() ?? Infinity;

    if (expiresAt < now && account.refreshToken) {
        const refreshed = await refreshGitHubToken(account.refreshToken);
        await db
            .update(betterAuthAccount)
            .set({
                accessToken: refreshed.access_token,
                refreshToken: refreshed.refresh_token,
                accessTokenExpiresAt: new Date(
                    Date.now() + refreshed.expires_in * 1000,
                ),
                refreshTokenExpiresAt: refreshed.refresh_token_expires_in
                    ? new Date(
                          Date.now() +
                              refreshed.refresh_token_expires_in * 1000,
                      )
                    : undefined,
            })
            .where(eq(betterAuthAccount.id, account.id));
        return refreshed.access_token;
    }

    return account.accessToken;
};
