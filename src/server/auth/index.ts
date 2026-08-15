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
 * Refresh the access token when it expires within this window instead of
 * waiting until after it has expired. Access tokens live on the order of
 * minutes to hours, so refreshing 30 minutes early is cheap and prevents a
 * token from dying mid-request (it also resets the refresh token's sliding
 * inactivity window).
 */
const ACCESS_TOKEN_REFRESH_LEEWAY_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Whether the account's access token is expired or due for refresh within the
 * leeway window. A null/absent expiry (accounts created before expiry
 * tracking) is treated as never expiring so they keep working.
 */
function isAccessTokenDue(expiresAt: Date | null | undefined): boolean {
    if (!expiresAt) return false;
    return expiresAt.getTime() - Date.now() <= ACCESS_TOKEN_REFRESH_LEEWAY_MS;
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

/**
 * Returns a usable access token for a provider account, refreshing the stored
 * token when it has expired.
 *
 * Refresh failures never fail the request. Providers rotate refresh tokens on
 * use, so a concurrent request may have already refreshed with the same token
 * while this one was in flight — the account row is re-read in that case and
 * the freshly stored token is used. Otherwise the stored access token is
 * returned as a best effort and the caller surfaces whatever the provider
 * rejects. No in-flight state is shared between requests; the account row is
 * the only coordination point.
 */
async function getProviderToken(
    database: typeof db,
    userId: string | null | undefined,
    providerId: "github" | "codeberg",
    refresh: (refreshToken: string) => Promise<RefreshedToken>,
): Promise<string> {
    const providerName = providerId === "github" ? "GitHub" : "Codeberg";
    if (!userId) throw new Error(`${providerName} account not connected`);

    const account = await findAccountByProvider(database, userId, providerId);
    if (!account?.accessToken) {
        throw new Error(`${providerName} account not connected`);
    }

    // A stored token that is still valid is used as-is.
    if (!isAccessTokenDue(account.accessTokenExpiresAt)) {
        try {
            return decrypt(account.accessToken);
        } catch {
            // Corrupted token: fall through and let the refresh replace it.
        }
    }

    let refreshToken: string | null = null;
    try {
        refreshToken = account.refreshToken
            ? decrypt(account.refreshToken)
            : null;
    } catch {
        // Corrupted refresh token: nothing to refresh with.
    }

    if (refreshToken) {
        try {
            return await refreshAndStoreToken(
                database,
                account.id,
                refreshToken,
                refresh,
            );
        } catch {
            // The refresh failed. Another request may have used this same
            // refresh token concurrently (providers invalidate refresh tokens
            // after use) and already stored fresh tokens — re-read the row and
            // use them instead of failing this request.
            const latest = await findAccountByProvider(
                database,
                userId,
                providerId,
            );
            if (
                latest?.accessToken &&
                !isAccessTokenDue(latest.accessTokenExpiresAt)
            ) {
                return decrypt(latest.accessToken);
            }
        }
    }

    // Best effort: return the stored token (even if expired) rather than
    // failing the request; the provider rejects it and the caller surfaces
    // that error.
    return decrypt(account.accessToken);
}

export const getGitHubToken = cache(
    async (database: typeof db, userId: string | null | undefined) => {
        if (!userId) {
            if (env.GITHUB_ANONYMOUS_TOKEN) return env.GITHUB_ANONYMOUS_TOKEN;
            throw new Error("GitHub account not connected");
        }
        try {
            return await getProviderToken(
                database,
                userId,
                "github",
                refreshGitHubToken,
            );
        } catch (error) {
            // No usable account (never connected, or removed after a dead
            // refresh token): fall back to anonymous browsing when enabled.
            if (env.GITHUB_ANONYMOUS_TOKEN) return env.GITHUB_ANONYMOUS_TOKEN;
            throw error;
        }
    },
);

export const githubAccessToken = cache(async () => {
    const uid = await getUserId();
    try {
        return await getProviderToken(db, uid, "github", refreshGitHubToken);
    } catch (error) {
        if (env.GITHUB_ANONYMOUS_TOKEN) return env.GITHUB_ANONYMOUS_TOKEN;
        if (error instanceof Error && error.message.includes("not connected")) {
            return null;
        }
        throw error;
    }
});

export const getCodebergToken = cache(
    async (database: typeof db, userId: string | null | undefined) =>
        getProviderToken(database, userId, "codeberg", refreshCodebergToken),
);

export const codebergAccessToken = cache(async () => {
    const uid = await getUserId();
    if (!uid) return null;
    try {
        return await getProviderToken(
            db,
            uid,
            "codeberg",
            refreshCodebergToken,
        );
    } catch (error) {
        if (error instanceof Error && error.message.includes("not connected")) {
            return null;
        }
        throw error;
    }
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
