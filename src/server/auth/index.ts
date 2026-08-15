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

/** Raised when a provider rejects the refresh token as expired or invalid. */
class RefreshTokenRejectedError extends Error {}

/** Provider error codes meaning the refresh token itself is dead. */
const REJECTED_REFRESH_ERROR_CODES = new Set([
    "bad_verification_code", // GitHub: expired/revoked/malformed refresh token
    "invalid_grant",
    "invalid_token",
    "refresh_token_expired",
]);

/**
 * A provider access token that can replace itself when the provider rejects
 * it with a 401. The stored expiry timestamp can lie (revoked tokens,
 * manually replaced tokens), so API layers swap in a fresh token via
 * `refresh()` and retry the request instead of trusting the timestamp.
 */
export type RefreshableAuth = string & { refresh: () => Promise<string> };

function withRefresh(
    token: string,
    refresh: () => Promise<string>,
): RefreshableAuth {
    return Object.assign(new String(token), {
        refresh,
    }) as unknown as RefreshableAuth;
}

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

    const body = (await res.json().catch(() => null)) as Record<
        string,
        unknown
    > | null;

    if (!res.ok || body?.error) {
        const code = typeof body?.error === "string" ? body.error : "";
        const description =
            typeof body?.error_description === "string"
                ? body.error_description
                : "";
        if (REJECTED_REFRESH_ERROR_CODES.has(code)) {
            throw new RefreshTokenRejectedError(
                description || "Refresh token expired",
            );
        }
        throw new Error(
            description || `Failed to refresh token (${res.status})`,
        );
    }

    return body as RefreshedToken;
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
            userId: betterAuthAccount.userId,
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
 * Refresh the access token when it expires within this window, before it
 * actually dies mid-request.
 */
const ACCESS_TOKEN_REFRESH_LEEWAY_MS = 30 * 60 * 1000; // 30 minutes

/**
 * True when the access token is expired or due for refresh. Null expiry
 * (pre-expiry-tracking accounts) means never expires.
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
    // expires_in counts from token issuance, so base the expiry on the request
    // start; deriving it from response receipt skews it later than the
    // provider's true expiry.
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
 * Returns a usable access token for a provider account, refreshing when due.
 *
 * Refresh failures never fail the request: if a concurrent request rotated the
 * refresh token, the freshly stored token is used; otherwise the stored token
 * is returned best-effort. The account row is the only coordination point —
 * no shared in-flight state.
 *
 * The returned token carries a `refresh()` that forces a rotation. API layers
 * call it when the provider rejects the token with a 401 — the stored expiry
 * can lie (revoked or manually replaced token), so a dead token must not be
 * trusted just because the timestamp looks valid.
 */
async function getProviderToken(
    database: typeof db,
    userId: string | null | undefined,
    providerId: "github" | "codeberg",
    refresh: (refreshToken: string) => Promise<RefreshedToken>,
    options?: { force?: boolean },
): Promise<RefreshableAuth> {
    const providerName = providerId === "github" ? "GitHub" : "Codeberg";
    if (!userId) throw new Error(`${providerName} account not connected`);

    const account = await findAccountByProvider(database, userId, providerId);
    if (!account?.accessToken) {
        throw new Error(`${providerName} account not connected`);
    }

    const refreshable = (token: string) =>
        withRefresh(token, () =>
            getProviderToken(database, userId, providerId, refresh, {
                force: true,
            }),
        );

    // A stored token that is still valid is used as-is.
    if (!options?.force && !isAccessTokenDue(account.accessTokenExpiresAt)) {
        try {
            return refreshable(decrypt(account.accessToken));
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
            return refreshable(
                await refreshAndStoreToken(
                    database,
                    account.id,
                    refreshToken,
                    refresh,
                ),
            );
        } catch (error) {
            // Refresh failed — a concurrent request may have rotated the token;
            // re-read the row and use what's stored now.
            const latest = await findAccountByProvider(
                database,
                userId,
                providerId,
            );
            const rotated =
                latest?.refreshToken !== undefined &&
                latest.refreshToken !== account.refreshToken;
            if (
                latest?.accessToken &&
                rotated &&
                !isAccessTokenDue(latest.accessTokenExpiresAt)
            ) {
                return refreshable(decrypt(latest.accessToken));
            }

            if (error instanceof RefreshTokenRejectedError) {
                // The refresh token is genuinely dead: unlink so the user
                // re-authenticates instead of failing every request.
                await unlinkProviderAccount(
                    database,
                    account.id,
                    account.userId,
                    providerId,
                );
                throw new Error(
                    `${providerName} account not connected (session expired)`,
                );
            }
        }
    }

    // Best effort: return the stored token (even if expired); the caller
    // surfaces provider rejection.
    return refreshable(decrypt(account.accessToken));
}

/**
 * Removes a provider account whose refresh token was rejected, dropping the
 * user back to the existing not-connected state and re-link flow.
 */
async function unlinkProviderAccount(
    database: typeof db,
    accountId: string,
    userId: string,
    providerId: "github" | "codeberg",
): Promise<void> {
    await database
        .update(betterAuthUser)
        .set(
            providerId === "github"
                ? { githubUsername: null }
                : { codebergUsername: null },
        )
        .where(eq(betterAuthUser.id, userId));
    await database
        .delete(betterAuthAccount)
        .where(eq(betterAuthAccount.id, accountId));
}

export const getGitHubToken = cache(
    async (
        database: typeof db,
        userId: string | null | undefined,
    ): Promise<string> => {
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
            // No usable account: fall back to anonymous browsing when enabled.
            if (env.GITHUB_ANONYMOUS_TOKEN) return env.GITHUB_ANONYMOUS_TOKEN;
            throw error;
        }
    },
);

export const githubAccessToken = cache(async (): Promise<string | null> => {
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
    async (
        database: typeof db,
        userId: string | null | undefined,
    ): Promise<string> =>
        getProviderToken(database, userId, "codeberg", refreshCodebergToken),
);

export const codebergAccessToken = cache(async (): Promise<string | null> => {
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

    const body = (await res.json().catch(() => null)) as Record<
        string,
        unknown
    > | null;

    if (!res.ok || body?.error) {
        const code = typeof body?.error === "string" ? body.error : "";
        const description =
            typeof body?.error_description === "string"
                ? body.error_description
                : "";
        if (REJECTED_REFRESH_ERROR_CODES.has(code)) {
            throw new RefreshTokenRejectedError(
                description || "Refresh token expired",
            );
        }
        throw new Error(
            description || `Failed to refresh Codeberg token (${res.status})`,
        );
    }

    return body as RefreshedToken;
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
