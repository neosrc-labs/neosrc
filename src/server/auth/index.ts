import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { type GenericOAuthConfig, genericOAuth } from "better-auth/plugins";
import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { env } from "~/env";
import { decrypt, encrypt } from "~/server/auth/encryption";
import { registerProviderTokenRefresh } from "~/server/auth/token-registry";
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

const TOKEN_REQUEST_TIMEOUT_MS = 10_000;

const REJECTED_REFRESH_ERROR_CODES: Record<string, true> = {
    bad_verification_code: true,
    bad_refresh_token: true,
    invalid_grant: true,
    invalid_token: true,
    refresh_token_expired: true,
};

class RefreshTokenRejectedError extends Error {
    constructor(
        message: string,
        readonly code: string,
    ) {
        super(message);
    }
}

export class ProviderAccountNotConnectedError extends Error {}
export class ProviderReauthenticationRequiredError extends Error {}
export class ProviderTokenUnavailableError extends Error {}

type RefreshedToken = {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    refresh_token_expires_in?: number;
};

export { getProviderTokenRefresh } from "~/server/auth/token-registry";

function parseRefreshedToken(body: Record<string, unknown>): RefreshedToken {
    if (
        typeof body.access_token !== "string" ||
        !body.access_token ||
        typeof body.expires_in !== "number" ||
        !Number.isFinite(body.expires_in) ||
        body.expires_in <= 0 ||
        (body.refresh_token !== undefined &&
            typeof body.refresh_token !== "string") ||
        (body.refresh_token_expires_in !== undefined &&
            (typeof body.refresh_token_expires_in !== "number" ||
                !Number.isFinite(body.refresh_token_expires_in) ||
                body.refresh_token_expires_in <= 0))
    ) {
        throw new Error("Provider returned an invalid token response");
    }

    return body as RefreshedToken;
}

async function requestRefreshedToken(
    url: string,
    body: Record<string, string | undefined>,
): Promise<RefreshedToken> {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
    });
    const responseBody = (await response.json().catch(() => null)) as Record<
        string,
        unknown
    > | null;

    if (!response.ok || responseBody?.error) {
        const code =
            typeof responseBody?.error === "string" ? responseBody.error : "";
        const description =
            typeof responseBody?.error_description === "string"
                ? responseBody.error_description
                : "";
        if (REJECTED_REFRESH_ERROR_CODES[code]) {
            throw new RefreshTokenRejectedError(
                description || "Refresh token expired",
                code,
            );
        }
        throw new Error(
            description || `Failed to refresh token (${response.status})`,
        );
    }
    if (!responseBody) {
        throw new Error("Provider returned an empty token response");
    }
    return parseRefreshedToken(responseBody);
}

function refreshGitHubToken(refreshToken: string) {
    return requestRefreshedToken(GITHUB_TOKEN_URL, {
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
    });
}

/**
 * True when both Codeberg OAuth credentials are set. Codeberg is optional:
 * without them the provider is not registered, so Codeberg entries must be
 * hidden from sign-in and account linking.
 */
export function isCodebergConfigured(): boolean {
    return Boolean(env.CODEBERG_CLIENT_ID && env.CODEBERG_CLIENT_SECRET);
}

/** Registered OAuth providers; empty when Codeberg is not configured. */
function codebergOAuthConfigs(): GenericOAuthConfig[] {
    const {
        CODEBERG_CLIENT_ID: clientId,
        CODEBERG_CLIENT_SECRET: clientSecret,
    } = env;
    if (!clientId || !clientSecret) return [];

    return [
        {
            providerId: "codeberg",
            clientId,
            clientSecret,
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
            overrideUserInfo: false,
            getUserInfo: async (tokens) => {
                if (!tokens.accessToken) return null;
                const profile = await getCodebergUser(tokens.accessToken);
                if (!profile) return null;
                return {
                    id: String(profile.id),
                    name: profile.full_name || profile.login,
                    email: profile.email,
                    image: profile.avatar_url,
                    emailVerified: false,
                };
            },
        },
    ];
}

async function syncAccountUsername(account: {
    id: string;
    providerId: string;
    accessToken?: string | null;
}) {
    if (!account.accessToken) return;

    try {
        const accessToken = decrypt(account.accessToken);
        const username =
            account.providerId === "github"
                ? (await getAuthenticatedUser(accessToken)).login
                : account.providerId === "codeberg"
                  ? (await getCodebergUser(accessToken))?.username
                  : undefined;
        if (!username) return;

        await db
            .update(betterAuthAccount)
            .set({ username })
            .where(eq(betterAuthAccount.id, account.id));
    } catch {
        // Account linkage remains valid when profile synchronization fails.
    }
}

export const AUTH_SESSION_FRESH_AGE_SECONDS = 15 * 60;

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
    session: {
        expiresIn: 7 * 24 * 60 * 60,
        updateAge: 24 * 60 * 60,
        freshAge: AUTH_SESSION_FRESH_AGE_SECONDS,
        deferSessionRefresh: true,
    },
    account: {
        additionalFields: {
            username: {
                type: "string",
                required: false,
                returned: true,
            },
        },
        accountLinking: {
            enabled: true,
            disableImplicitLinking: false,
            allowDifferentEmails: true,
            updateUserInfoOnLink: false,
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
            overrideUserInfoOnSignIn: false,
        },
    },
    plugins: [genericOAuth({ config: codebergOAuthConfigs() }), nextCookies()],
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
                after: syncAccountUsername,
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
                after: async (account) => {
                    await db
                        .update(betterAuthAccount)
                        .set({
                            connectionStatus: "active",
                            credentialVersion: sql`${betterAuthAccount.credentialVersion} + 1`,
                            lastAuthError: null,
                        })
                        .where(eq(betterAuthAccount.id, account.id));
                    await syncAccountUsername(account);
                },
            },
            delete: {},
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

type ProviderId = "github" | "codeberg";

async function findAccountByProvider(
    database: typeof db,
    userId: string,
    providerId: ProviderId,
    lock = false,
) {
    const query = database
        .select({
            id: betterAuthAccount.id,
            userId: betterAuthAccount.userId,
            connectionStatus: betterAuthAccount.connectionStatus,
            credentialVersion: betterAuthAccount.credentialVersion,
            accessToken: betterAuthAccount.accessToken,
            accessTokenExpiresAt: betterAuthAccount.accessTokenExpiresAt,
            refreshToken: betterAuthAccount.refreshToken,
            refreshTokenExpiresAt: betterAuthAccount.refreshTokenExpiresAt,
            lastRefreshedAt: betterAuthAccount.lastRefreshedAt,
            lastAuthError: betterAuthAccount.lastAuthError,
        })
        .from(betterAuthAccount)
        .where(
            and(
                eq(betterAuthAccount.userId, userId),
                eq(betterAuthAccount.providerId, providerId),
            ),
        )
        .limit(1);
    const [account] = lock ? await query.for("update") : await query;
    return account;
}

type ProviderAccount = NonNullable<
    Awaited<ReturnType<typeof findAccountByProvider>>
>;

type ProviderTokenResult = { token: string } | { error: Error };

const ACCESS_TOKEN_REFRESH_LEEWAY_MS = 30 * 60 * 1000;
const REFRESH_FAILURE_COOLDOWN_MS = 30 * 1000;
const providerRefreshes = new Map<string, Promise<string>>();

function isAccessTokenDue(expiresAt: Date | null | undefined): boolean {
    if (!expiresAt) return false;
    return expiresAt.getTime() - Date.now() <= ACCESS_TOKEN_REFRESH_LEEWAY_MS;
}

function isAccessTokenExpired(expiresAt: Date | null | undefined): boolean {
    return Boolean(expiresAt && expiresAt.getTime() <= Date.now());
}

function isRefreshCoolingDown(account: ProviderAccount): boolean {
    return Boolean(
        account.lastAuthError &&
            account.lastRefreshedAt &&
            Date.now() - account.lastRefreshedAt.getTime() <
                REFRESH_FAILURE_COOLDOWN_MS,
    );
}

function providerName(providerId: ProviderId): string {
    return providerId === "github" ? "GitHub" : "Codeberg";
}

function accessTokenFrom(account: ProviderAccount): string | null {
    if (!account.accessToken) return null;
    try {
        return decrypt(account.accessToken);
    } catch {
        return null;
    }
}

function accountStateError(
    account: ProviderAccount | undefined,
    name: string,
): Error | null {
    if (!account) {
        return new ProviderAccountNotConnectedError(
            `${name} account not connected`,
        );
    }
    if (account.connectionStatus === "reauth_required") {
        return new ProviderReauthenticationRequiredError(
            `${name} account requires reconnection`,
        );
    }
    return null;
}

function credentialsChanged(
    current: ProviderAccount,
    observed: ProviderAccount,
): boolean {
    return (
        current.credentialVersion !== observed.credentialVersion ||
        current.accessToken !== observed.accessToken ||
        current.refreshToken !== observed.refreshToken
    );
}

function concurrentCredentialResult(
    account: ProviderAccount,
    name: string,
): ProviderTokenResult {
    const error = accountStateError(account, name);
    if (error) return { error };
    const token = accessTokenFrom(account);
    if (token && !isAccessTokenExpired(account.accessTokenExpiresAt)) {
        return { token };
    }
    return {
        error: new ProviderTokenUnavailableError(
            `${name} credentials are unavailable`,
        ),
    };
}

async function recordRefreshFailure(
    database: typeof db,
    account: ProviderAccount,
    error: unknown,
): Promise<void> {
    const message =
        error instanceof Error ? error.message.slice(0, 500) : "Refresh failed";
    await database
        .update(betterAuthAccount)
        .set({
            lastRefreshedAt: new Date(),
            lastAuthError: message,
        })
        .where(eq(betterAuthAccount.id, account.id));
}

async function markReauthenticationRequired(
    database: typeof db,
    account: ProviderAccount,
    error: RefreshTokenRejectedError,
): Promise<void> {
    await database
        .update(betterAuthAccount)
        .set({
            connectionStatus: "reauth_required",
            credentialVersion: sql`${betterAuthAccount.credentialVersion} + 1`,
            accessToken: null,
            refreshToken: null,
            idToken: null,
            accessTokenExpiresAt: null,
            refreshTokenExpiresAt: null,
            lastRefreshedAt: new Date(),
            lastAuthError: error.code || error.message.slice(0, 500),
        })
        .where(eq(betterAuthAccount.id, account.id));
}

async function storeRefreshedToken(
    database: typeof db,
    account: ProviderAccount,
    refreshed: RefreshedToken,
    issuedAt: number,
): Promise<void> {
    await database
        .update(betterAuthAccount)
        .set({
            connectionStatus: "active",
            credentialVersion: sql`${betterAuthAccount.credentialVersion} + 1`,
            accessToken: encrypt(refreshed.access_token),
            refreshToken: refreshed.refresh_token
                ? encrypt(refreshed.refresh_token)
                : account.refreshToken,
            accessTokenExpiresAt: new Date(
                issuedAt + refreshed.expires_in * 1000,
            ),
            refreshTokenExpiresAt: refreshed.refresh_token_expires_in
                ? new Date(issuedAt + refreshed.refresh_token_expires_in * 1000)
                : account.refreshTokenExpiresAt,
            lastRefreshedAt: new Date(),
            lastAuthError: null,
        })
        .where(eq(betterAuthAccount.id, account.id));
}

async function settleRefreshFailure(
    database: typeof db,
    observed: ProviderAccount,
    providerId: ProviderId,
    error: unknown,
    force: boolean,
): Promise<ProviderTokenResult> {
    return database.transaction(async (transaction) => {
        const tx = transaction as unknown as typeof db;
        const current = await findAccountByProvider(
            tx,
            observed.userId,
            providerId,
            true,
        );
        const name = providerName(providerId);
        const stateError = accountStateError(current, name);
        if (stateError || !current) {
            return {
                error:
                    stateError ??
                    new ProviderAccountNotConnectedError(
                        `${name} account not connected`,
                    ),
            };
        }
        if (credentialsChanged(current, observed)) {
            return concurrentCredentialResult(current, name);
        }
        if (error instanceof RefreshTokenRejectedError) {
            await markReauthenticationRequired(tx, current, error);
            return {
                error: new ProviderReauthenticationRequiredError(
                    `${name} account requires reconnection`,
                ),
            };
        }

        await recordRefreshFailure(tx, current, error);
        const token = accessTokenFrom(current);
        if (
            token &&
            !force &&
            !isAccessTokenExpired(current.accessTokenExpiresAt)
        ) {
            return { token };
        }
        return {
            error: new ProviderTokenUnavailableError(
                `${name} token refresh failed`,
            ),
        };
    });
}

async function refreshProviderTokenOnce(
    database: typeof db,
    userId: string,
    providerId: ProviderId,
    expectedAccessToken: string | null,
    refresh: (refreshToken: string) => Promise<RefreshedToken>,
    force: boolean,
): Promise<string> {
    const account = await findAccountByProvider(database, userId, providerId);
    const name = providerName(providerId);
    const stateError = accountStateError(account, name);
    if (stateError || !account) {
        throw (
            stateError ??
            new ProviderAccountNotConnectedError(
                `${name} account not connected`,
            )
        );
    }

    const accessToken = accessTokenFrom(account);
    const tokenChanged = account.accessToken !== expectedAccessToken;
    if (
        accessToken &&
        ((!force && !isAccessTokenDue(account.accessTokenExpiresAt)) ||
            (force &&
                tokenChanged &&
                !isAccessTokenDue(account.accessTokenExpiresAt)))
    ) {
        return accessToken;
    }
    if (isRefreshCoolingDown(account)) {
        if (
            accessToken &&
            !force &&
            !isAccessTokenExpired(account.accessTokenExpiresAt)
        ) {
            return accessToken;
        }
        throw new ProviderTokenUnavailableError(
            `${name} token refresh temporarily unavailable`,
        );
    }

    let refreshToken: string | null = null;
    try {
        refreshToken = account.refreshToken
            ? decrypt(account.refreshToken)
            : null;
    } catch {
        refreshToken = null;
    }

    if (!refreshToken) {
        const result = await settleRefreshFailure(
            database,
            account,
            providerId,
            new Error("Refresh token is unavailable"),
            force,
        );
        if ("error" in result) throw result.error;
        return result.token;
    }

    const issuedAt = Date.now();
    let refreshed: RefreshedToken;
    try {
        refreshed = await refresh(refreshToken);
    } catch (error) {
        const result = await settleRefreshFailure(
            database,
            account,
            providerId,
            error,
            force,
        );
        if ("error" in result) throw result.error;
        return result.token;
    }

    const result = await database.transaction(async (transaction) => {
        const tx = transaction as unknown as typeof db;
        const current = await findAccountByProvider(
            tx,
            userId,
            providerId,
            true,
        );
        const currentStateError = accountStateError(current, name);
        if (currentStateError || !current) {
            return {
                error:
                    currentStateError ??
                    new ProviderAccountNotConnectedError(
                        `${name} account not connected`,
                    ),
            } satisfies ProviderTokenResult;
        }
        if (credentialsChanged(current, account)) {
            return concurrentCredentialResult(current, name);
        }

        await storeRefreshedToken(tx, current, refreshed, issuedAt);
        return { token: refreshed.access_token } satisfies ProviderTokenResult;
    });
    if ("error" in result) throw result.error;
    return result.token;
}

async function refreshProviderToken(
    database: typeof db,
    userId: string,
    providerId: ProviderId,
    expectedAccessToken: string | null,
    refresh: (refreshToken: string) => Promise<RefreshedToken>,
    force: boolean,
): Promise<string> {
    const key = `${userId}\0${providerId}`;
    const existing = providerRefreshes.get(key);
    if (existing) return existing;

    const pending = refreshProviderTokenOnce(
        database,
        userId,
        providerId,
        expectedAccessToken,
        refresh,
        force,
    );
    providerRefreshes.set(key, pending);
    try {
        return await pending;
    } finally {
        if (providerRefreshes.get(key) === pending) {
            providerRefreshes.delete(key);
        }
    }
}

async function getProviderToken(
    database: typeof db,
    userId: string | null | undefined,
    providerId: ProviderId,
    refresh: (refreshToken: string) => Promise<RefreshedToken>,
): Promise<string> {
    const name = providerName(providerId);
    if (!userId) {
        throw new ProviderAccountNotConnectedError(
            `${name} account not connected`,
        );
    }

    const account = await findAccountByProvider(database, userId, providerId);
    if (!account) {
        throw new ProviderAccountNotConnectedError(
            `${name} account not connected`,
        );
    }
    if (account.connectionStatus === "reauth_required") {
        throw new ProviderReauthenticationRequiredError(
            `${name} account requires reconnection`,
        );
    }

    const refreshable = (token: string) =>
        registerProviderTokenRefresh(token, async () => {
            await refreshProviderToken(
                database,
                userId,
                providerId,
                account.accessToken,
                refresh,
                true,
            );
            return getProviderToken(database, userId, providerId, refresh);
        });
    const accessToken = accessTokenFrom(account);
    if (accessToken && !isAccessTokenDue(account.accessTokenExpiresAt)) {
        return refreshable(accessToken);
    }

    return refreshable(
        await refreshProviderToken(
            database,
            userId,
            providerId,
            account.accessToken,
            refresh,
            false,
        ),
    );
}

export const getGitHubToken = cache(
    async (
        database: typeof db,
        userId: string | null | undefined,
    ): Promise<string> => {
        if (!userId) {
            if (env.GITHUB_ANONYMOUS_TOKEN) return env.GITHUB_ANONYMOUS_TOKEN;
            throw new ProviderAccountNotConnectedError(
                "GitHub account not connected",
            );
        }
        return getProviderToken(database, userId, "github", refreshGitHubToken);
    },
);

export const githubAccessToken = cache(async (): Promise<string | null> => {
    const userId = await getUserId();
    if (!userId) return env.GITHUB_ANONYMOUS_TOKEN ?? null;
    try {
        return await getProviderToken(db, userId, "github", refreshGitHubToken);
    } catch (error) {
        if (
            error instanceof ProviderAccountNotConnectedError ||
            error instanceof ProviderReauthenticationRequiredError
        ) {
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
    const userId = await getUserId();
    if (!userId) return null;
    try {
        return await getProviderToken(
            db,
            userId,
            "codeberg",
            refreshCodebergToken,
        );
    } catch (error) {
        if (
            error instanceof ProviderAccountNotConnectedError ||
            error instanceof ProviderReauthenticationRequiredError
        ) {
            return null;
        }
        throw error;
    }
});

function refreshCodebergToken(refreshToken: string) {
    return requestRefreshedToken(CODEBERG_TOKEN_URL, {
        client_id: env.CODEBERG_CLIENT_ID,
        client_secret: env.CODEBERG_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
    });
}

export type AuthProviderId = "github" | "codeberg";

export type LinkedProviderAccount = {
    id: string;
    accountId: string;
    providerId: AuthProviderId;
    username: string | null;
    connectionStatus: "active" | "reauth_required";
};

export async function getLinkedAccounts(
    database: typeof db,
    userId: string,
): Promise<LinkedProviderAccount[]> {
    const accounts = await database
        .select({
            id: betterAuthAccount.id,
            accountId: betterAuthAccount.accountId,
            providerId: betterAuthAccount.providerId,
            username: betterAuthAccount.username,
            connectionStatus: betterAuthAccount.connectionStatus,
        })
        .from(betterAuthAccount)
        .where(eq(betterAuthAccount.userId, userId));

    return accounts.flatMap((account) =>
        account.providerId === "github" || account.providerId === "codeberg"
            ? [{ ...account, providerId: account.providerId }]
            : [],
    );
}

export async function getLinkedAccount(
    database: typeof db,
    userId: string,
    providerId: AuthProviderId,
): Promise<LinkedProviderAccount | undefined> {
    const [account] = await database
        .select({
            id: betterAuthAccount.id,
            accountId: betterAuthAccount.accountId,
            providerId: betterAuthAccount.providerId,
            username: betterAuthAccount.username,
            connectionStatus: betterAuthAccount.connectionStatus,
        })
        .from(betterAuthAccount)
        .where(
            and(
                eq(betterAuthAccount.userId, userId),
                eq(betterAuthAccount.providerId, providerId),
            ),
        )
        .limit(1);

    return account
        ? {
              ...account,
              providerId,
          }
        : undefined;
}
export async function getGithubUsername(
    userId: string | null,
    accessToken: string,
): Promise<string | undefined> {
    if (accessToken === env.GITHUB_ANONYMOUS_TOKEN) return undefined;
    const account = userId
        ? (await getLinkedAccounts(db, userId)).find(
              ({ providerId }) => providerId === "github",
          )
        : null;

    return (
        account?.username ??
        (!userId ? (await getAuthenticatedUser(accessToken)).login : undefined)
    );
}

export function isAnonymousToken(token: string): boolean {
    return !!env.GITHUB_ANONYMOUS_TOKEN && token === env.GITHUB_ANONYMOUS_TOKEN;
}
