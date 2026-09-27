import { createHmac } from "node:crypto";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
    user: [] as Record<string, unknown>[],
    session: [] as Record<string, unknown>[],
    account: [] as Record<string, unknown>[],
    verification: [] as Record<string, unknown>[],
}));

vi.mock("~/env", () => ({
    env: {
        BETTER_AUTH_SECRET:
            "account-linking-test-secret-at-least-32-characters",
        BETTER_AUTH_URL: "http://localhost:3000",
        GITHUB_CLIENT_ID: "test-github-client",
        GITHUB_CLIENT_SECRET: "test-github-secret",
        CODEBERG_CLIENT_ID: "test-codeberg-client",
        CODEBERG_CLIENT_SECRET: "test-codeberg-secret",
        DATA_ENCRYPTION_KEY: "a".repeat(64),
    },
}));
vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/server/auth/database-adapter", () => ({
    createAuthDatabaseAdapter: () => memoryAdapter(store),
}));

import { POST } from "~/app/api/auth/[...all]/route";
import { auth } from "~/server/auth";

const origin = "http://localhost:3000";
const token = "linking-session-fixture";
const providers = [
    {
        name: "Codeberg",
        path: "/oauth2/link",
        body: { providerId: "codeberg" },
        authorizationURL: "https://codeberg.org/login/oauth/authorize",
    },
    {
        name: "GitHub",
        path: "/link-social",
        body: { provider: "github" },
        authorizationURL: "https://github.com/login/oauth/authorize",
    },
];

async function linkRequest(
    provider: (typeof providers)[number],
    options: { authenticated?: boolean; requestOrigin?: string } = {},
) {
    const context = await auth.$context;
    const signature = createHmac("sha256", context.secret)
        .update(token)
        .digest("base64");
    const headers = new Headers({
        "content-type": "application/json",
        origin: options.requestOrigin ?? origin,
    });
    if (options.authenticated !== false) {
        headers.set(
            "cookie",
            `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${signature}`)}`,
        );
    }
    return new Request(`${origin}/api/auth${provider.path}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            ...provider.body,
            callbackURL: "/profile?account=linked",
            errorCallbackURL: "/profile?authError=link",
        }),
    });
}

beforeEach(async () => {
    const context = await auth.$context;
    // Better Auth skips origin checks in test mode.
    context.skipOriginCheck = false;
    const now = new Date();
    const createdAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    store.user = [
        {
            id: "user-1",
            name: "Fixture User",
            email: "fixture@example.com",
            emailVerified: true,
            createdAt,
            updatedAt: now,
        },
    ];
    store.session = [
        {
            id: "session-1",
            userId: "user-1",
            token,
            createdAt,
            updatedAt: now,
            expiresAt: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000),
        },
    ];
    store.account = [
        {
            id: "github-account",
            userId: "user-1",
            providerId: "github",
            accountId: "github-user-1",
            createdAt,
            updatedAt: now,
        },
    ];
    store.verification = [];
    vi.stubGlobal("fetch", async (url: string | URL) => {
        if (
            String(url) !==
            "https://codeberg.org/.well-known/openid-configuration"
        ) {
            throw new Error(`Unexpected provider request: ${url}`);
        }
        return Response.json({
            authorization_endpoint:
                "https://codeberg.org/login/oauth/authorize",
        });
    });
});

afterEach(() => vi.unstubAllGlobals());

describe.each(providers)("$name account linking", (provider) => {
    it("starts OAuth from a day-old session and binds linking to the signed-in user", async () => {
        const response = await POST(await linkRequest(provider));
        const body = await response.json();

        expect(response.status, JSON.stringify(body)).toBe(200);
        const url = new URL(body.url);
        expect(`${url.origin}${url.pathname}`).toBe(provider.authorizationURL);
        expect(body.redirect).toBe(true);
        const state = store.verification.find(
            (entry) => entry.identifier === url.searchParams.get("state"),
        );
        expect(state).toBeDefined();
        expect(JSON.parse(String(state?.value))).toMatchObject({
            link: { userId: "user-1", email: "fixture@example.com" },
            callbackURL: "/profile?account=linked",
        });
    });

    it("rejects requests without a signed-in session", async () => {
        const response = await POST(
            await linkRequest(provider, { authenticated: false }),
        );

        expect(response.status).toBe(401);
        expect(store.verification).toEqual([]);
    });

    it("rejects an expired session", async () => {
        Object.assign(store.session[0]!, {
            expiresAt: new Date(Date.now() - 1000),
        });

        const response = await POST(await linkRequest(provider));

        expect(response.status).toBe(401);
        expect(store.verification).toEqual([]);
    });

    it("rejects linking initiated by an untrusted origin", async () => {
        const response = await POST(
            await linkRequest(provider, {
                requestOrigin: "https://untrusted.example",
            }),
        );

        expect(response.status).toBe(403);
        expect(store.verification).toEqual([]);
    });
});
