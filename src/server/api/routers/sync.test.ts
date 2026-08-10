import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub the modules the router pulls in so the test needs no env vars, a real
// postgres connection, or an auth session.
vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/env", () => ({
    env: { GITHUB_ANONYMOUS_TOKEN: "shared-anonymous-token" },
}));
vi.mock("~/logging", () => ({
    log: { info: vi.fn(), error: vi.fn() },
}));
vi.mock("~/server/auth", () => ({
    getSession: vi.fn(),
    getGitHubToken: vi.fn(),
    getCodebergToken: vi.fn(),
    isAnonymousToken: vi.fn(),
}));
vi.mock("~/server/sync", () => ({
    refreshOwnerRepos: vi.fn(),
    syncCurrentUser: vi.fn(),
}));

import { syncRouter } from "~/server/api/routers/sync";
import { createCallerFactory, createTRPCContext } from "~/server/api/trpc";
import {
    getCodebergToken,
    getGitHubToken,
    getSession,
    isAnonymousToken,
} from "~/server/auth";
import { syncCurrentUser } from "~/server/sync";

const getSessionMock = vi.mocked(getSession);
const getGitHubTokenMock = vi.mocked(getGitHubToken);
const getCodebergTokenMock = vi.mocked(getCodebergToken);
const isAnonymousTokenMock = vi.mocked(isAnonymousToken);
const syncCurrentUserMock = vi.mocked(syncCurrentUser);

const sampleResult = {
    accountsUpserted: 1,
    reposUpserted: 5,
    relationsWritten: 2,
    relationsRemoved: 1,
    teamsSkipped: 0,
};

async function createCaller() {
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } } as never);
    const ctx = await createTRPCContext({ headers: new Headers() });
    return createCallerFactory(syncRouter)(ctx);
}

describe("syncRouter.currentUser", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        syncCurrentUserMock.mockResolvedValue(sampleResult);
    });

    it("returns sync results for every connected provider instead of short-circuiting", async () => {
        getGitHubTokenMock.mockResolvedValue("gh-token");
        getCodebergTokenMock.mockResolvedValue("cb-token");
        isAnonymousTokenMock.mockReturnValue(false);

        const caller = await createCaller();
        await expect(caller.currentUser()).resolves.toEqual({
            github: sampleResult,
            codeberg: sampleResult,
        });
        expect(syncCurrentUserMock).toHaveBeenCalledTimes(2);
        expect(syncCurrentUserMock).toHaveBeenCalledWith(expect.anything(), {
            provider: "github",
            accessToken: "gh-token",
        });
        expect(syncCurrentUserMock).toHaveBeenCalledWith(expect.anything(), {
            provider: "codeberg",
            accessToken: "cb-token",
        });
    });

    it("still resolves with the single connected provider when only one is linked", async () => {
        getGitHubTokenMock.mockResolvedValue("gh-token");
        getCodebergTokenMock.mockRejectedValue(
            new Error("Codeberg account not connected"),
        );
        isAnonymousTokenMock.mockReturnValue(false);

        const caller = await createCaller();
        await expect(caller.currentUser()).resolves.toEqual({
            github: sampleResult,
        });
        expect(syncCurrentUserMock).toHaveBeenCalledTimes(1);
    });

    it("skips the shared anonymous token and rejects when no real provider is connected", async () => {
        getGitHubTokenMock.mockResolvedValue("anon-token");
        getCodebergTokenMock.mockRejectedValue(
            new Error("Codeberg account not connected"),
        );
        isAnonymousTokenMock.mockReturnValue(true);

        const caller = await createCaller();
        await expect(caller.currentUser()).rejects.toMatchObject({
            code: "BAD_REQUEST",
        });
        expect(syncCurrentUserMock).not.toHaveBeenCalled();
    });
});
