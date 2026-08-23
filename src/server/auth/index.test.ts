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
import { getCodebergToken, getGitHubToken } from "./index";

// ---------------------------------------------------------------------------
// Fake database
// The getters only touch a small slice of the drizzle query builder: select
// the account row, update it after a refresh, delete it on unlink.
// ---------------------------------------------------------------------------

type AccountRow = {
    id: string;
    userId: string;
    accessToken: string | null;
    accessTokenExpiresAt: Date | null;
    refreshToken: string | null;
};

function createFakeDb(rows: AccountRow[]) {
    const state = {
        rows,
        updates: [] as Array<Record<string, unknown>>,
        deletedAccountIds: [] as string[],
    };
    const fakeDb = {
        select: () => ({
            from: () => ({
                where: () => ({
                    limit: async () => state.rows,
                }),
            }),
        }),
        update: () => ({
            set: (data: Record<string, unknown>) => ({
                where: async () => {
                    state.updates.push(data);
                },
            }),
        }),
        delete: () => ({
            where: async () => {
                state.deletedAccountIds.push(state.rows[0]?.id ?? "unknown");
            },
        }),
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
        accessToken: encrypt("stale-access"),
        accessTokenExpiresAt: new Date(Date.now() - 60_000),
        refreshToken: encrypt("stale-refresh"),
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

    it("clears refreshTokenExpiresAt when the provider omits refresh_token_expires_in", async () => {
        const { fakeDb, state } = createFakeDb([expiredGitHubAccount()]);
        mockFetch({
            ok: true,
            status: 200,
            body: { ...REFRESHED_BODY, refresh_token_expires_in: undefined },
        });

        await getGitHubToken(fakeDb, "user-1");

        expect(state.updates[0]?.refreshTokenExpiresAt).toBeNull();
    });

    it("throws for a user with no connected account", async () => {
        const { fakeDb } = createFakeDb([]);

        await expect(getGitHubToken(fakeDb, "user-1")).rejects.toThrow(
            "GitHub account not connected",
        );
    });

    it("falls back to the stored token when the refresh fails transiently", async () => {
        const { fakeDb } = createFakeDb([expiredGitHubAccount()]);
        mockFetch({ ok: false, status: 502, body: {} });

        // A failed refresh must not fail the request.
        await expect(
            getGitHubToken(fakeDb, "user-1").then((t) => String(t)),
        ).resolves.toBe("stale-access");
    });

    it("uses the concurrently refreshed token when the refresh races and loses", async () => {
        const { fakeDb, state } = createFakeDb([expiredGitHubAccount()]);
        // Refresh fails because a concurrent request already rotated the
        // token; the loser re-reads the row and finds the winner's tokens.
        const fetchMock = vi.fn(async (_input: string | URL | Request) => {
            state.rows[0] = {
                ...state.rows[0]!,
                accessToken: encrypt("winner-access"),
                accessTokenExpiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
                refreshToken: encrypt("winner-refresh"),
            };
            return {
                ok: false,
                status: 400,
                json: async () => ({ error: "bad_verification_code" }),
            };
        });
        vi.stubGlobal("fetch", fetchMock);

        const token = await getGitHubToken(fakeDb, "user-1");

        expect(String(token)).toBe("winner-access");
        // The loser must not overwrite the winner's row.
        expect(state.updates).toHaveLength(0);
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

        const token = (await getGitHubToken(fakeDb, "user-1")) as string & {
            refresh: () => Promise<string>;
        };
        expect(String(token)).toBe("dead-access");
        expect(fetchMock).not.toHaveBeenCalled();

        const fresh = await token.refresh();

        expect(String(fresh)).toBe("fresh-access");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(state.updates).toHaveLength(1);
    });

    it("unlinks the account when the refresh token is rejected and not rotated", async () => {
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
            "GitHub account not connected (session expired)",
        );
        // Account row deleted and the mirrored username cleared, so the
        // existing UI shows the re-link flow.
        expect(state.deletedAccountIds).toEqual(["acct-1"]);
        expect(state.updates).toContainEqual({ githubUsername: null });
    });

    it("unlinks the account when GitHub rejects with bad_refresh_token", async () => {
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
            "GitHub account not connected (session expired)",
        );
        expect(state.deletedAccountIds).toEqual(["acct-1"]);
        expect(state.updates).toContainEqual({ githubUsername: null });
    });

    it("keeps the account when a rejected refresh was actually a rotation race", async () => {
        const { fakeDb, state } = createFakeDb([expiredGitHubAccount()]);
        const fetchMock = vi.fn(async (_input: string | URL | Request) => {
            state.rows[0] = {
                ...state.rows[0]!,
                accessToken: encrypt("winner-access"),
                accessTokenExpiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
                refreshToken: encrypt("winner-refresh"),
            };
            return {
                ok: false,
                status: 400,
                json: async () => ({
                    error: "bad_verification_code",
                    error_description: "The refresh_token provided is expired",
                }),
            };
        });
        vi.stubGlobal("fetch", fetchMock);

        const token = await getGitHubToken(fakeDb, "user-1");

        expect(String(token)).toBe("winner-access");
        expect(state.deletedAccountIds).toHaveLength(0);
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

    it("unlinks a codeberg account whose refresh token is rejected", async () => {
        const { fakeDb, state } = createFakeDb([expiredGitHubAccount()]);
        mockFetch({
            ok: false,
            status: 400,
            body: { error: "invalid_grant" },
        });

        await expect(getCodebergToken(fakeDb, "user-1")).rejects.toThrow(
            "Codeberg account not connected (session expired)",
        );
        expect(state.deletedAccountIds).toEqual(["acct-1"]);
        expect(state.updates).toContainEqual({ codebergUsername: null });
    });
});
