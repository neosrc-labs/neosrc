import { describe, expect, it, vi } from "vitest";

const envState = vi.hoisted(() => ({
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    GITHUB_CLIENT_ID: "test",
    GITHUB_CLIENT_SECRET: "test",
    CODEBERG_CLIENT_ID: "test",
    CODEBERG_CLIENT_SECRET: "test",
    DATA_ENCRYPTION_KEY: "a".repeat(64),
    GITHUB_ANONYMOUS_TOKEN: "test-anon",
}));

vi.mock("~/env", () => ({ env: envState }));

vi.mock("~/server/db", () => ({ db: {} }));

import { GET } from "~/app/api/auth/[...all]/route";

describe("auth callback routing", () => {
    it("redirects GitHub App install callbacks to onboarding", async () => {
        const res = await GET(
            new Request(
                "http://localhost:3000/api/auth/callback/github?code=abc&installation_id=42&setup_action=install",
            ),
        );

        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toBe(
            "http://localhost:3000/onboarding",
        );
    });

    it("does not intercept callbacks without setup_action", async () => {
        const res = await GET(
            new Request(
                "http://localhost:3000/api/auth/callback/github?code=abc",
            ),
        );

        // Handed off to better-auth; a state-less callback is rejected there.
        expect(res.status).not.toBe(307);
    });
});
