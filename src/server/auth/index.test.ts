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

        expect(token).toBe("valid-access");
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

        expect(token).toBe("fresh-access");
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

        // issuedAt is captured before the refresh request is sent, so the
        // stored expiries are offset from the request start — not from when
        // the response arrives. This keeps them aligned with the provider's
        // issuance-based expires_in semantics.
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

        expect(token).toBe("fresh-access");
        expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
            "codeberg.org/login/oauth/access_token",
        );
        expect(state.updates).toHaveLength(1);
    });
});
