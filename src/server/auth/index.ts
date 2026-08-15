import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { genericOAuth } from "better-auth/plugins";
import { and, eq } from "drizzle-orm";
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
import { getUser as getCodebergUser } from "../codeberg";
import { getAuthenticatedUser } from "../github";

const CODEBERG_TOKEN_URL = "https://codeberg.org/login/oauth/access_token";

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
    account: {
        accountLinking: {
            enabled: true,
            trustedProviders: ["github", "codeberg"],
            allowDifferentEmails: true,
            updateUserInfoOnLink: true,
        },
    },
    user: {
        additionalFields: {
            githubUsername: {
                type: "string",
                required: false,
                returned: true,
            },
            codebergUsername: {
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
                "workflow",
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
    plugins: [
        genericOAuth({
            config: [
                {
                    providerId: "codeberg",
                    clientId: env.CODEBERG_CLIENT_ID,
                    clientSecret: env.CODEBERG_CLIENT_SECRET,
                    discoveryUrl:
                        "https://codeberg.org/.well-known/openid-configuration",
                    scopes: [
                        "read:user",
                        "write:user",
                        "read:repository",
                        "write:repository",
                        "read:issue",
                        "write:issue",
                    ],
                    overrideUserInfo: true,
                    getUserInfo: async (tokens) => {
                        if (!tokens.accessToken) return null;
                        const profile = await getCodebergUser(
                            tokens.accessToken,
                        );
                        if (!profile) return null;
                        return {
                            id: String(profile.id),
                            name: profile.full_name || profile.login,
                            email: profile.email,
                            image: profile.avatar_url,
                            emailVerified: true,
                            codebergUsername: profile.username,
                        };
                    },
                },
            ],
        }),
        nextCookies(),
    ],
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
                after: async (account) => {
                    if (
                        account.providerId === "codeberg" &&
                        account.accessToken
                    ) {
                        try {
                            const accessToken = decrypt(account.accessToken);
                            const profile = await getCodebergUser(accessToken);
                            if (profile) {
                                await db
                                    .update(betterAuthUser)
                                    .set({
                                        codebergUsername: profile.username,
                                    })
                                    .where(
                                        eq(betterAuthUser.id, account.userId),
                                    );
                            }
                        } catch {
                            // silently fail; username will be fetched on demand
                        }
                    }
                    if (
                        account.providerId === "github" &&
                        account.accessToken
                    ) {
                        try {
                            const accessToken = decrypt(account.accessToken);
                            const profile =
                                await getAuthenticatedUser(accessToken);
                            await db
                                .update(betterAuthUser)
                                .set({
                                    githubUsername: profile.login,
                                })
                                .where(eq(betterAuthUser.id, account.userId));
                        } catch {
                            // silently fail; username will be fetched on demand
                        }
                    }
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
            delete: {
                after: async (account) => {
                    if (account.providerId === "codeberg") {
                        await db
                            .update(betterAuthUser)
                            .set({ codebergUsername: null })
                            .where(eq(betterAuthUser.id, account.userId));
                    }
                    if (account.providerId === "github") {
                        await db
                            .update(betterAuthUser)
                            .set({ githubUsername: null })
                            .where(eq(betterAuthUser.id, account.userId));
                    }
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

type RefreshedToken = {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    refresh_token_expires_in?: number;
};

/**
 * Loads the stored account row for a provider, including the encrypted token
 * fields needed for refresh decisions.
 */
async function findAccountByProvider(
    database: typeof db,
    userId: string,
    providerId: string,
) {
    const [account] = await database
        .select({
            id: betterAuthAccount.id,
            accessToken: betterAuthAccount.accessToken,
            accessTokenExpiresAt: betterAuthAccount.accessTokenExpiresAt,
            refreshToken: betterAuthAccount.refreshToken,
        })
        .from(betterAuthAccount)
        .where(
            and(
                eq(betterAuthAccount.userId, userId),
                eq(betterAuthAccount.providerId, providerId),
            ),
        )
        .limit(1);

    return account;
}

/**
 * The decrypted refresh token when the account's access token has expired,
 * else null. Callers refresh via refreshAndStoreToken.
 */
function getExpiredRefreshToken(account: {
    accessTokenExpiresAt: Date | null;
    refreshToken: string | null;
}): string | null {
    const now = Date.now();
    const expiresAt = account.accessTokenExpiresAt?.getTime() ?? Infinity;
    const refreshToken = account.refreshToken
        ? decrypt(account.refreshToken)
        : null;

    return expiresAt < now ? refreshToken : null;
}

/**
 * Refreshes a token with the provider, stores the new encrypted tokens on the
 * account row, and returns the fresh access token.
 */
async function refreshAndStoreToken(
    database: typeof db,
    accountId: string,
    refreshToken: string,
    refresh: (refreshToken: string) => Promise<RefreshedToken>,
): Promise<string> {
    // Providers (GitHub documents this explicitly) count expires_in from the
    // moment the token is issued, i.e. when our refresh request is sent —
    // not from when we receive the response. Basing the stored expiry on the
    // request start keeps it aligned with the provider's clock; deriving it
    // from response receipt would skew it later by the round-trip latency,
    // leaving a window where we consider the token valid but the provider
    // has already expired it.
    const issuedAt = Date.now();
    const refreshed = await refresh(refreshToken);
    await database
        .update(betterAuthAccount)
        .set({
            accessToken: encrypt(refreshed.access_token),
            refreshToken: encrypt(refreshed.refresh_token),
            accessTokenExpiresAt: new Date(
                issuedAt + refreshed.expires_in * 1000,
            ),
            refreshTokenExpiresAt: refreshed.refresh_token_expires_in
                ? new Date(issuedAt + refreshed.refresh_token_expires_in * 1000)
                : null,
        })
        .where(eq(betterAuthAccount.id, accountId));
    return refreshed.access_token;
}

export const getGitHubToken = cache(
    async (database: typeof db, userId: string | null | undefined) => {
        if (!userId) {
            if (env.GITHUB_ANONYMOUS_TOKEN) return env.GITHUB_ANONYMOUS_TOKEN;
            throw new Error("GitHub account not connected");
        }
        const account = await findAccountByProvider(database, userId, "github");

        if (!account?.accessToken) {
            if (env.GITHUB_ANONYMOUS_TOKEN) return env.GITHUB_ANONYMOUS_TOKEN;
            throw new Error("GitHub account not connected");
        }

        const refreshToken = getExpiredRefreshToken(account);

        if (refreshToken) {
            return refreshAndStoreToken(
                database,
                account.id,
                refreshToken,
                refreshGitHubToken,
            );
        }

        try {
            return decrypt(account.accessToken);
        } catch (e) {
            // If the token gets corrupted somehow, just try to refresh it
            const retryToken = account.refreshToken
                ? decrypt(account.refreshToken)
                : null;
            if (retryToken) {
                return refreshAndStoreToken(
                    database,
                    account.id,
                    retryToken,
                    refreshGitHubToken,
                );
            }
            throw e;
        }
    },
);

export const getAccountByProvider = cache(async (providerId: string) => {
    const uid = await getUserId();
    if (!uid) return null;

    const [account] = await db
        .select()
        .from(betterAuthAccount)
        .where(
            and(
                eq(betterAuthAccount.userId, uid),
                eq(betterAuthAccount.providerId, providerId),
            ),
        )
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
        idToken: account.idToken ? decrypt(account.idToken) : account.idToken,
    };
});

export const githubAccessToken = cache(async () => {
    const account = await getAccountByProvider("github");

    if (account) {
        const now = Date.now();
        const expiresAt = account.accessTokenExpiresAt?.getTime() ?? Infinity;

        if (expiresAt < now && account.refreshToken) {
            return refreshAndStoreToken(
                db,
                account.id,
                account.refreshToken,
                refreshGitHubToken,
            );
        }

        return account.accessToken;
    }
    if (env.GITHUB_ANONYMOUS_TOKEN) return env.GITHUB_ANONYMOUS_TOKEN;
    return null;
});

export const getCodebergToken = cache(
    async (database: typeof db, userId: string | null | undefined) => {
        if (!userId) throw new Error("Codeberg account not connected");
        const account = await findAccountByProvider(
            database,
            userId,
            "codeberg",
        );

        if (!account?.accessToken) {
            throw new Error("Codeberg account not connected");
        }

        const refreshToken = getExpiredRefreshToken(account);

        if (refreshToken) {
            return refreshAndStoreToken(
                database,
                account.id,
                refreshToken,
                refreshCodebergToken,
            );
        }

        return decrypt(account.accessToken);
    },
);

export const codebergAccessToken = cache(async () => {
    const account = await getAccountByProvider("codeberg");

    if (!account) return null;

    const now = Date.now();
    const expiresAt = account.accessTokenExpiresAt?.getTime() ?? Infinity;

    if (expiresAt < now && account.refreshToken) {
        return refreshAndStoreToken(
            db,
            account.id,
            account.refreshToken,
            refreshCodebergToken,
        );
    }

    return account.accessToken;
});

async function refreshCodebergToken(refreshToken: string) {
    const res = await fetch(CODEBERG_TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({
            client_id: env.CODEBERG_CLIENT_ID,
            client_secret: env.CODEBERG_CLIENT_SECRET,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
        }),
    });

    if (!res.ok) {
        throw new Error("Failed to refresh Codeberg token");
    }

    return res.json() as Promise<{
        access_token: string;
        refresh_token: string;
        expires_in: number;
        refresh_token_expires_in?: number;
    }>;
}

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
    if (accessToken === env.GITHUB_ANONYMOUS_TOKEN) return undefined;
    // Try to get the username from the database since it's probably
    // faster, but fallback to github if its missing.
    return (
        (userId
            ? (await getUser(userId))?.githubUsername
            : (await getAuthenticatedUser(accessToken)).login) ?? undefined
    );
}

export function isAnonymousToken(token: string): boolean {
    return !!env.GITHUB_ANONYMOUS_TOKEN && token === env.GITHUB_ANONYMOUS_TOKEN;
}
