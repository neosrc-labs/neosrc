import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { env } from "~/env";
import { decrypt, encrypt } from "~/server/auth/encryption";
import { db } from "~/server/db";
import {
    betterAuthAccount,
    betterAuthSession,
    betterAuthUser,
    betterAuthVerification,
} from "~/server/db/schema";
import { getAuthenticatedUser } from "../github";

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
    user: {
        additionalFields: {
            githubUsername: {
                type: "string",
                required: false,
                returned: true,
            },
        },
    },
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
            overrideUserInfoOnSignIn: true,
            mapProfileToUser: (profile) => {
                return {
                    githubUsername: profile.login,
                };
            },
        },
    },
    plugins: [nextCookies()],
    databaseHooks: {
        account: {
            create: {
                before: async (data) => {
                    return {
                        data: {
                            ...data,
                            accessToken: data.accessToken
                                ? encrypt(data.accessToken)
                                : data.accessToken,
                            refreshToken: data.refreshToken
                                ? encrypt(data.refreshToken)
                                : data.refreshToken,
                            idToken: data.idToken
                                ? encrypt(data.idToken)
                                : data.idToken,
                        },
                    };
                },
            },
            update: {
                before: async (data) => {
                    const encrypted: Record<string, string | null | undefined> =
                        {};
                    if (data.accessToken !== undefined) {
                        encrypted.accessToken = data.accessToken
                            ? encrypt(data.accessToken)
                            : data.accessToken;
                    }
                    if (data.refreshToken !== undefined) {
                        encrypted.refreshToken = data.refreshToken
                            ? encrypt(data.refreshToken)
                            : data.refreshToken;
                    }
                    if (data.idToken !== undefined) {
                        encrypted.idToken = data.idToken
                            ? encrypt(data.idToken)
                            : data.idToken;
                    }
                    return { data: { ...data, ...encrypted } };
                },
            },
        },
    },
});

export const getSession = cache(async () =>
    auth.api.getSession({ headers: await headers() }),
);

const getUserId = async (userId?: string) => {
    if (userId) return userId;
    const session = await getSession();
    return session?.user?.id ?? null;
};

export const getAccount = cache(
    async (opts?: { db?: typeof db; userId?: string }) => {
        const uid = await getUserId(opts?.userId);
        if (!uid) return null;

        const database = opts?.db ?? db;

        const [account] = await database
            .select()
            .from(betterAuthAccount)
            .where(eq(betterAuthAccount.userId, uid))
            .limit(1);

        if (!account) return null;

        return {
            ...account,
            accessToken: account.accessToken
                ? decrypt(account.accessToken)
                : account.accessToken,
            refreshToken: account.refreshToken
                ? decrypt(account.refreshToken)
                : account.refreshToken,
            idToken: account.idToken
                ? decrypt(account.idToken)
                : account.idToken,
        };
    },
);

export const getGitHubToken = async (database: typeof db, userId: string) => {
    const [account] = await database
        .select({ accessToken: betterAuthAccount.accessToken })
        .from(betterAuthAccount)
        .where(eq(betterAuthAccount.userId, userId))
        .limit(1);

    if (!account?.accessToken) {
        throw new Error("GitHub account not connected");
    }

    return decrypt(account.accessToken);
};

export const githubAccessToken = cache(async () => {
    const account = await getAccount();

    if (!account) return null;

    const now = Date.now();
    const expiresAt = account.accessTokenExpiresAt?.getTime() ?? Infinity;

    if (expiresAt < now && account.refreshToken) {
        const refreshed = await refreshGitHubToken(account.refreshToken);
        await db
            .update(betterAuthAccount)
            .set({
                accessToken: encrypt(refreshed.access_token),
                refreshToken: encrypt(refreshed.refresh_token),
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
});

export async function getUser(userId: string) {
    const [user] = await db
        .select({ githubUsername: betterAuthUser.githubUsername })
        .from(betterAuthUser)
        .where(eq(betterAuthUser.id, userId))
        .limit(1);

    return user;
}

export async function getGithubUsername(
    userId: string | null,
    accessToken: string,
): Promise<string | undefined> {
    // Try to get the username from the database since it's probably
    // faster, but fallback to github if its missing.
    return (
        (userId
            ? (await getUser(userId))?.githubUsername
            : (await getAuthenticatedUser(accessToken)).login) ?? undefined
    );
}
