import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    authPost: vi.fn(async () => new Response(null, { status: 204 })),
    getSession: vi.fn(),
}));

vi.mock("better-auth/next-js", () => ({
    toNextJsHandler: () => ({
        GET: vi.fn(),
        POST: mocks.authPost,
    }),
}));

vi.mock("~/server/auth", () => ({
    AUTH_SESSION_FRESH_AGE_SECONDS: 15 * 60,
    auth: {
        api: { getSession: mocks.getSession },
        handler: vi.fn(),
    },
}));

import { POST } from "~/app/api/auth/[...all]/route";

function linkRequest(path = "/api/auth/link-social") {
    return new Request(`http://localhost:3000${path}`, { method: "POST" });
}

describe("account linking session freshness", () => {
    beforeEach(() => {
        mocks.authPost.mockClear();
        mocks.getSession.mockReset();
    });

    it("rejects account linking when the session is stale", async () => {
        mocks.getSession.mockResolvedValue({
            session: { createdAt: new Date(Date.now() - 16 * 60 * 1000) },
        });

        const response = await POST(linkRequest());

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
            code: "SESSION_NOT_FRESH",
        });
        expect(mocks.authPost).not.toHaveBeenCalled();
    });

    it("passes account linking through for a fresh session", async () => {
        mocks.getSession.mockResolvedValue({
            session: { createdAt: new Date() },
        });

        const request = linkRequest("/api/auth/oauth2/link");
        const response = await POST(request);

        expect(response.status).toBe(204);
        expect(mocks.authPost).toHaveBeenCalledWith(request);
    });

    it("does not require freshness for other auth endpoints", async () => {
        const request = linkRequest("/api/auth/sign-out");
        const response = await POST(request);

        expect(response.status).toBe(204);
        expect(mocks.getSession).not.toHaveBeenCalled();
        expect(mocks.authPost).toHaveBeenCalledWith(request);
    });
});
