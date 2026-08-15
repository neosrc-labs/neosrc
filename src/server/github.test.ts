import { describe, expect, it, vi } from "vitest";

// Stub the DB and env modules so importing github.ts does not open a real
// postgres connection or validate env vars during test load.
vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/env", () => ({
    env: {
        BETTER_AUTH_SECRET: "test-secret",
        BETTER_AUTH_URL: "http://localhost:3000",
        GITHUB_CLIENT_ID: "test",
        GITHUB_CLIENT_SECRET: "test",
        CODEBERG_CLIENT_ID: "test",
        CODEBERG_CLIENT_SECRET: "test",
        DATABASE_URL: "postgres://localhost:5432/neosrc",
        NODE_ENV: "test",
    },
}));

import { createOctokit } from "~/server/github";

type RefreshableAuth = string & { refresh: () => Promise<string> };

function jsonResponse(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

describe("createOctokit", () => {
    it("refreshes the token and retries once when GitHub rejects it with 401", async () => {
        const refresh = vi.fn(async () => "fresh-token");
        const auth = Object.assign(new String("dead-token"), {
            refresh,
        }) as unknown as RefreshableAuth;

        const fetchMock = vi.fn(async (input: string | URL | Request) => {
            const url = String(input);
            if (url.startsWith("https://api.github.com/user")) {
                const userCalls = fetchMock.mock.calls.filter(([i]) =>
                    String(i).startsWith("https://api.github.com/user"),
                );
                if (userCalls.length === 1) {
                    // First attempt: the stored token is dead.
                    return jsonResponse({ message: "Bad credentials" }, 401);
                }
                return jsonResponse({ login: "octocat", id: 1 }, 200);
            }
            throw new Error(`unexpected fetch: ${url}`);
        });
        vi.stubGlobal("fetch", fetchMock);

        const octokit = createOctokit(auth);
        const { data } = await octokit.rest.users.getAuthenticated();

        expect(data.login).toBe("octocat");
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(
            fetchMock.mock.calls.filter(([i]) =>
                String(i).startsWith("https://api.github.com/user"),
            ),
        ).toHaveLength(2);
    });

    it("does not refresh for plain string tokens", async () => {
        const fetchMock = vi.fn(async (_input: string | URL | Request) =>
            jsonResponse({ message: "Bad credentials" }, 401),
        );
        vi.stubGlobal("fetch", fetchMock);

        const octokit = createOctokit("plain-token");
        await expect(octokit.rest.users.getAuthenticated()).rejects.toThrow();

        expect(
            fetchMock.mock.calls.filter(([i]) =>
                String(i).startsWith("https://api.github.com/user"),
            ),
        ).toHaveLength(1);
    });

    it("retries at most once per client even if the fresh token is also rejected", async () => {
        const refresh = vi.fn(async () => "also-dead-token");
        const auth = Object.assign(new String("dead-token"), {
            refresh,
        }) as unknown as RefreshableAuth;

        const fetchMock = vi.fn(async (_input: string | URL | Request) =>
            jsonResponse({ message: "Bad credentials" }, 401),
        );
        vi.stubGlobal("fetch", fetchMock);

        const octokit = createOctokit(auth);
        await expect(octokit.rest.users.getAuthenticated()).rejects.toThrow();

        expect(refresh).toHaveBeenCalledTimes(1);
        expect(
            fetchMock.mock.calls.filter(([i]) =>
                String(i).startsWith("https://api.github.com/user"),
            ),
        ).toHaveLength(2);
    });
});
