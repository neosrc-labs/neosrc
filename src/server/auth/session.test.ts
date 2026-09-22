import { createHmac } from "node:crypto";
import { betterAuth } from "better-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
    query: vi.fn<(query: string, params: unknown[]) => Promise<unknown[][]>>(),
}));

vi.mock("~/env", () => ({
    env: {
        BETTER_AUTH_SECRET:
            "session-recovery-test-secret-at-least-32-characters",
        BETTER_AUTH_URL: "http://localhost:3000",
        GITHUB_CLIENT_ID: "test",
        GITHUB_CLIENT_SECRET: "test",
        DATABASE_URL: "postgres://unused/session_recovery_test",
        DATA_ENCRYPTION_KEY: "a".repeat(64),
        NODE_ENV: "production",
    },
}));

vi.mock("postgres", () => ({
    default: () => ({
        options: { parsers: {}, serializers: {}, max: 2 },
        unsafe: (query: string, params: unknown[]) => ({
            values: () => database.query(query, params),
        }),
    }),
}));

import { auth } from "~/server/auth";

const sessionAuth = betterAuth({ ...auth.options, logger: { disabled: true } });
const token = "session-recovery-fixture";
const userId = "user-1";
let staleConnections = 0;
let disconnectUserLookup = false;

function connectionClosed() {
    return Object.assign(new Error("write CONNECTION_CLOSED"), {
        code: "CONNECTION_CLOSED",
    });
}

async function requestSession() {
    const context = await sessionAuth.$context;
    const signature = createHmac("sha256", context.secret)
        .update(token)
        .digest("base64");
    return sessionAuth.handler(
        new Request("http://localhost:3000/api/auth/get-session", {
            headers: {
                cookie: `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${signature}`)}`,
            },
        }),
    );
}

beforeEach(() => {
    staleConnections = 0;
    disconnectUserLookup = false;
    database.query.mockReset();
    database.query.mockImplementation(async (query) => {
        if (staleConnections > 0) {
            staleConnections -= 1;
            throw connectionClosed();
        }
        const now = new Date().toISOString();
        if (query.startsWith("select") && query.includes('"ba_session"')) {
            return [
                [
                    "session-1",
                    new Date(Date.now() + 86_400_000).toISOString(),
                    token,
                    now,
                    now,
                    null,
                    null,
                    userId,
                ],
            ];
        }
        if (query.startsWith("select") && query.includes('"ba_user"')) {
            if (disconnectUserLookup) {
                disconnectUserLookup = false;
                throw connectionClosed();
            }
            return [
                [
                    userId,
                    "Fixture User",
                    "fixture@example.com",
                    true,
                    null,
                    now,
                    now,
                ],
            ];
        }
        throw new Error(`Unexpected database query: ${query}`);
    });
});

describe("session database connection recovery", () => {
    it("keeps the user signed in after exhausting multiple stale connections", async () => {
        staleConnections = 2;

        const response = await requestSession();

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            session: { id: "session-1", userId },
            user: { id: userId },
        });
    });

    it("recovers when the joined user lookup loses its connection", async () => {
        disconnectUserLookup = true;

        const response = await requestSession();

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            session: { id: "session-1", userId },
            user: { id: userId },
        });
    });

    it("returns an error after bounded recovery instead of signing the user out", async () => {
        database.query.mockRejectedValue(connectionClosed());

        const response = await requestSession();

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toMatchObject({
            code: "FAILED_TO_GET_SESSION",
        });
        expect(database.query).toHaveBeenCalledTimes(3);
    });

    it("does not retry a non-connection database failure", async () => {
        database.query.mockRejectedValue(
            Object.assign(new Error("permission denied for table ba_session"), {
                code: "42501",
            }),
        );

        const response = await requestSession();

        expect(response.status).toBe(500);
        expect(database.query).toHaveBeenCalledTimes(1);
    });

    it("does not replay a session write after losing its acknowledgement", async () => {
        const context = await sessionAuth.$context;
        let committedWrites = 0;
        database.query.mockImplementation(async () => {
            committedWrites += 1;
            throw connectionClosed();
        });

        await expect(
            context.internalAdapter.updateSession(token, {
                expiresAt: new Date(Date.now() + 86_400_000),
            }),
        ).rejects.toMatchObject({ cause: { code: "CONNECTION_CLOSED" } });
        expect(committedWrites).toBe(1);
    });
});
