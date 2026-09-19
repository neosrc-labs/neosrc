import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Module mocking
// The auth module reads env at load time (better-auth construction), so mock
// `~/env` before importing. `~/server/db` is mocked because the module binds
// the real connection at import; the getters under test receive an explicit
// fake database instead.
// ---------------------------------------------------------------------------

const envState = vi.hoisted(() => ({
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    GITHUB_CLIENT_ID: "test",
    GITHUB_CLIENT_SECRET: "test",
    CODEBERG_CLIENT_ID: "test",
    CODEBERG_CLIENT_SECRET: "test",
    DATA_ENCRYPTION_KEY: "a".repeat(64),
    GITHUB_ANONYMOUS_TOKEN: undefined as string | undefined,
}));

vi.mock("~/env", () => ({ env: envState }));

vi.mock("~/server/db", () => ({ db: {} }));

import type { db } from "~/server/db";
import { decrypt, encrypt } from "./encryption";
import {
    getCodebergToken,
    getGitHubToken,
    getProviderTokenRefresh,
} from "./index";

type AccountRow = {
    id: string;
    userId: string;
    connectionStatus: "active" | "reauth_required";
    credentialVersion: number;
    accessToken: string | null;
    accessTokenExpiresAt: Date | null;
    refreshToken: string | null;
    refreshTokenExpiresAt: Date | null;
    lastAuthError?: string | null;
};

function createFakeDb(rows: AccountRow[]) {
    const state = {
        rows,
        updates: [] as Array<Record<string, unknown>>,
    };
    let transactionTail = Promise.resolve();
    const fakeDb: Record<string, unknown> = {};

    fakeDb.select = () => ({
        from: () => ({
            where: () => ({
                limit: () => {
                    const result = Promise.resolve(state.rows);
                    return Object.assign(result, {
                        for: async () => state.rows,
                    });
                },
            }),
        }),
    });
    fakeDb.update = () => ({
        set: (data: Record<string, unknown>) => ({
            where: async () => {
                const row = state.rows[0];
                const applied = { ...data };
                if (row && "credentialVersion" in applied) {
                    applied.credentialVersion = row.credentialVersion + 1;
                }
                if (row) Object.assign(row, applied);
                state.updates.push(applied);
            },
        }),
    });
    fakeDb.transaction = async (
        run: (transaction: unknown) => Promise<unknown>,
    ) => {
        let release = () => {};
        const current = new Promise<void>((resolve) => {
            release = resolve;
        });
        const previous = transactionTail;
        transactionTail = current;
        await previous;
        try {
            return await run(fakeDb);
        } finally {
            release();
        }
    };

    return { fakeDb: fakeDb as unknown as typeof db, state };
}

function mockFetch(response: {
    ok: boolean;
    status: number;
    body: Record<string, unknown>;
}) {
    const fetchMock = vi.fn(async (_input: string | URL | Request) => {
        (fetchMock as { calledAt?: number }).calledAt = Date.now();
        return {
            ok: response.ok,
            status: response.status,
            json: async () => response.body,
        };
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

function expiredGitHubAccount(overrides: Partial<AccountRow> = {}): AccountRow {
    return {
        id: "acct-1",
        userId: "user-1",
        connectionStatus: "active",
        credentialVersion: 0,
        accessToken: encrypt("stale-access"),
        accessTokenExpiresAt: new Date(Date.now() - 60_000),
        refreshToken: encrypt("stale-refresh"),
        refreshTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        ...overrides,
    };
}

const REFRESHED_BODY = {
    access_token: "fresh-access",
    expires_in: 28800,
    refresh_token: "fresh-refresh",
    refresh_token_expires_in: 15897600,
    token_type: "bearer",
    scope: "",
};

beforeEach(() => {
    vi.unstubAllGlobals();
    envState.GITHUB_ANONYMOUS_TOKEN = undefined;
});

describe("getGitHubToken", () => {
    it("returns the stored token without refreshing while it is valid", async () => {
        const { fakeDb, state } = createFakeDb([
            expiredGitHubAccount({
                accessToken: encrypt("valid-access"),
                accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
            }),
        ]);
        const fetchMock = mockFetch({
            ok: true,
            status: 200,
            body: REFRESHED_BODY,
        });

        const token = await getGitHubToken(fakeDb, "user-1");

        expect(String(token)).toBe("valid-access");
        expect(fetchMock).not.toHaveBeenCalled();
        expect(state.updates).toHaveLength(0);
    });

    it("refreshes an expired token and stores the new tokens", async () => {
        const { fakeDb, state } = createFakeDb([expiredGitHubAccount()]);
        const fetchMock = mockFetch({
            ok: true,
            status: 200,
            body: REFRESHED_BODY,
        });

        const token = await getGitHubToken(fakeDb, "user-1");

        expect(String(token)).toBe("fresh-access");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(state.updates).toHaveLength(1);
        expect(decrypt(state.updates[0]?.accessToken as string)).toBe(
            "fresh-access",
        );
        expect(decrypt(state.updates[0]?.refreshToken as string)).toBe(
            "fresh-refresh",
        );
    });

    it("bases stored expiries on token issuance (request start), not response receipt", async () => {
        const { fakeDb, state } = createFakeDb([expiredGitHubAccount()]);
        const fetchMock = mockFetch({
            ok: true,
            status: 200,
            body: REFRESHED_BODY,
        });

        await getGitHubToken(fakeDb, "user-1");

        // Expiries are offset from the request start, not response receipt,
        // matching the provider's issuance-based expires_in.
        const calledAt = (fetchMock as { calledAt?: number }).calledAt ?? 0;
        const accessTokenExpiresAt = state.updates[0]
            ?.accessTokenExpiresAt as Date;
        const refreshTokenExpiresAt = state.updates[0]
            ?.refreshTokenExpiresAt as Date;

        expect(
            Math.abs(accessTokenExpiresAt.getTime() - (calledAt + 28_800_000)),
        ).toBeLessThan(1000);
        expect(
            refreshTokenExpiresAt.getTime() - accessTokenExpiresAt.getTime(),
        ).toBe(15_897_600_000 - 28_800_000);
    });

    it("preserves refresh credentials when the provider omits replacements", async () => {
        const originalExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const { fakeDb, state } = createFakeDb([
            expiredGitHubAccount({ refreshTokenExpiresAt: originalExpiry }),
        ]);
        mockFetch({
            ok: true,
            status: 200,
            body: {
                access_token: "fresh-access",
                expires_in: 28_800,
            },
        });

        await getGitHubToken(fakeDb, "user-1");

        expect(decrypt(state.rows[0]?.refreshToken ?? "")).toBe(
            "stale-refresh",
        );
        expect(state.rows[0]?.refreshTokenExpiresAt).toEqual(originalExpiry);
    });

    it("throws for a user with no connected account", async () => {
        const { fakeDb } = createFakeDb([]);

        await expect(getGitHubToken(fakeDb, "user-1")).rejects.toThrow(
            "GitHub account not connected",
        );
    });

    it("does not downgrade a signed-in user to the anonymous token", async () => {
        const { fakeDb } = createFakeDb([]);
        envState.GITHUB_ANONYMOUS_TOKEN = "shared-token";

        await expect(getGitHubToken(fakeDb, "user-1")).rejects.toThrow(
            "GitHub account not connected",
        );
    });

    it("does not return an expired token after a transient refresh failure", async () => {
        const { fakeDb, state } = createFakeDb([expiredGitHubAccount()]);
        mockFetch({ ok: false, status: 502, body: {} });

        await expect(getGitHubToken(fakeDb, "user-1")).rejects.toThrow(
            "GitHub token refresh failed",
        );
        expect(state.rows[0]?.lastAuthError).toContain("502");
    });

    it("serializes concurrent refreshes for the same account", async () => {
        const { fakeDb } = createFakeDb([expiredGitHubAccount()]);
        const fetchMock = mockFetch({
            ok: true,
            status: 200,
            body: REFRESHED_BODY,
        });

        const tokens = await Promise.all([
            getGitHubToken(fakeDb, "user-1"),
            getGitHubToken(fakeDb, "user-1"),
        ]);

        expect(tokens.map(String)).toEqual(["fresh-access", "fresh-access"]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("refreshes a corrupted stored access token", async () => {
        const { fakeDb, state } = createFakeDb([
            expiredGitHubAccount({ accessToken: "not-valid-ciphertext" }),
        ]);
        mockFetch({ ok: true, status: 200, body: REFRESHED_BODY });

        const token = await getGitHubToken(fakeDb, "user-1");

        expect(String(token)).toBe("fresh-access");
        expect(state.updates).toHaveLength(1);
    });

    it("refreshes before expiry when the token is within the leeway window", async () => {
        const { fakeDb, state } = createFakeDb([
            expiredGitHubAccount({
                accessToken: encrypt("soon-to-expire"),
                // 20 minutes left: inside the 30 minute refresh leeway.
                accessTokenExpiresAt: new Date(Date.now() + 20 * 60 * 1000),
            }),
        ]);
        mockFetch({ ok: true, status: 200, body: REFRESHED_BODY });

        const token = await getGitHubToken(fakeDb, "user-1");

        expect(String(token)).toBe("fresh-access");
        expect(state.updates).toHaveLength(1);
    });

    it("does not refresh a token that expires beyond the leeway window", async () => {
        const { fakeDb, state } = createFakeDb([
            expiredGitHubAccount({
                accessToken: encrypt("valid-access"),
                // 45 minutes left: outside the 30 minute refresh leeway.
                accessTokenExpiresAt: new Date(Date.now() + 45 * 60 * 1000),
            }),
        ]);
        const fetchMock = mockFetch({
            ok: true,
            status: 200,
            body: REFRESHED_BODY,
        });

        const token = await getGitHubToken(fakeDb, "user-1");

        expect(String(token)).toBe("valid-access");
        expect(fetchMock).not.toHaveBeenCalled();
        expect(state.updates).toHaveLength(0);
    });

    it("refreshes via refresh() when the stored token is dead but the timestamp still looks valid", async () => {
        // Reported scenario: the access token was replaced in the DB with a
        // correctly-encrypted but expired one, while accessTokenExpiresAt
        // still points hours into the future. The timestamp check says "valid",
        // so the app hands out the dead token, until GitHub rejects it with a
        // 401, at which point refresh() must force a rotation.
        const { fakeDb, state } = createFakeDb([
            expiredGitHubAccount({
                accessToken: encrypt("dead-access"),
                accessTokenExpiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
            }),
        ]);
        const fetchMock = mockFetch({
            ok: true,
            status: 200,
            body: REFRESHED_BODY,
        });

        const token = await getGitHubToken(fakeDb, "user-1");
        expect(token).toBe("dead-access");
        expect(fetchMock).not.toHaveBeenCalled();

        const refresh = getProviderTokenRefresh(token);
        const fresh = await refresh?.();

        expect(String(fresh)).toBe("fresh-access");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(state.updates).toHaveLength(1);
    });

    it("keeps the identity and requires reauthentication after terminal rejection", async () => {
        const { fakeDb, state } = createFakeDb([expiredGitHubAccount()]);
        mockFetch({
            ok: false,
            status: 400,
            body: {
                error: "bad_verification_code",
                error_description: "The refresh_token provided is expired",
            },
        });

        await expect(getGitHubToken(fakeDb, "user-1")).rejects.toThrow(
            "GitHub account requires reconnection",
        );
        expect(state.rows).toHaveLength(1);
        expect(state.rows[0]).toMatchObject({
            id: "acct-1",
            connectionStatus: "reauth_required",
            accessToken: null,
            refreshToken: null,
            lastAuthError: "bad_verification_code",
        });
    });

    it("recognizes GitHub bad_refresh_token as terminal", async () => {
        const { fakeDb, state } = createFakeDb([expiredGitHubAccount()]);
        mockFetch({
            ok: false,
            status: 400,
            body: {
                error: "bad_refresh_token",
                error_description:
                    "The refresh token passed is incorrect or expired.",
            },
        });

        await expect(getGitHubToken(fakeDb, "user-1")).rejects.toThrow(
            "GitHub account requires reconnection",
        );
        expect(state.rows[0]?.connectionStatus).toBe("reauth_required");
    });

    it("does not use credentials already marked for reauthentication", async () => {
        const { fakeDb, state } = createFakeDb([
            expiredGitHubAccount({
                connectionStatus: "reauth_required",
            }),
        ]);
        const fetchMock = mockFetch({
            ok: true,
            status: 200,
            body: REFRESHED_BODY,
        });

        await expect(getGitHubToken(fakeDb, "user-1")).rejects.toThrow(
            "GitHub account requires reconnection",
        );
        expect(fetchMock).not.toHaveBeenCalled();
        expect(state.updates).toHaveLength(0);
    });
});

describe("getCodebergToken", () => {
    it("refreshes an expired token via the codeberg endpoint", async () => {
        const { fakeDb, state } = createFakeDb([expiredGitHubAccount()]);
        const fetchMock = mockFetch({
            ok: true,
            status: 200,
            body: REFRESHED_BODY,
        });

        const token = await getCodebergToken(fakeDb, "user-1");

        expect(String(token)).toBe("fresh-access");
        expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
            "codeberg.org/login/oauth/access_token",
        );
        expect(state.updates).toHaveLength(1);
    });

    it("preserves a codeberg identity after terminal rejection", async () => {
        const { fakeDb, state } = createFakeDb([expiredGitHubAccount()]);
        mockFetch({
            ok: false,
            status: 400,
            body: { error: "invalid_grant" },
        });

        await expect(getCodebergToken(fakeDb, "user-1")).rejects.toThrow(
            "Codeberg account requires reconnection",
        );
        expect(state.rows).toHaveLength(1);
        expect(state.rows[0]?.connectionStatus).toBe("reauth_required");
        expect(state.rows[0]?.lastAuthError).toBe("invalid_grant");
    });
});
