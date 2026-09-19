import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getCodebergToken: vi.fn(),
    getGitHubToken: vi.fn(),
    getLinkedAccount: vi.fn(),
    getReportsByPullRequest: vi.fn(),
    getCachedCodebergRepo: vi.fn(),
    getCachedGitHubRepo: vi.fn(),
    getRepoPermissionForUser: vi.fn(),
}));

vi.mock("~/env", () => ({
    env: { GITHUB_ANONYMOUS_TOKEN: "shared-anonymous-token" },
}));
vi.mock("~/logging", () => ({
    log: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/server/auth", () => ({
    getSession: vi.fn(),
    getCodebergToken: mocks.getCodebergToken,
    getGitHubToken: mocks.getGitHubToken,
    getLinkedAccount: mocks.getLinkedAccount,
}));
vi.mock("~/server/db/reports", () => ({
    getReportsByPullRequest: mocks.getReportsByPullRequest,
}));
vi.mock("~/server/codeberg", () => ({
    getCachedRepo: mocks.getCachedCodebergRepo,
}));
vi.mock("~/server/github", () => ({
    getCachedRepo: mocks.getCachedGitHubRepo,
}));
vi.mock("~/server/repo-cache", async (importOriginal) => {
    const actual = (await importOriginal()) as object;
    return {
        ...actual,
        getRepoPermissionForUser: mocks.getRepoPermissionForUser,
    };
});

import { createCallerFactory } from "~/server/api/trpc";
import { reportsRouter } from "./reports";

const createCaller = createCallerFactory(reportsRouter);
const context = {
    headers: new Headers(),
    db: {},
    session: { user: { id: "user-1" } },
    isAnonymous: false,
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getGitHubToken.mockResolvedValue("github-token");
    mocks.getLinkedAccount.mockResolvedValue({
        providerId: "github",
        username: "viewer",
        connectionStatus: "active",
    });
    mocks.getRepoPermissionForUser.mockResolvedValue(null);
    mocks.getCachedGitHubRepo.mockResolvedValue({
        owner: { login: "owner" },
        private: false,
    });
    mocks.getReportsByPullRequest.mockResolvedValue([{ id: 1 }]);
});

describe("reports repository authorization", () => {
    it("does not return reports for a private repository without a grant", async () => {
        mocks.getCachedGitHubRepo.mockResolvedValue({
            owner: { login: "owner" },
            private: true,
        });
        const caller = createCaller(context as never);

        await expect(
            caller.getReportsByPullRequest({
                provider: "gh",
                repository: "owner/private-repo",
                prNumber: 7,
            }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
        expect(mocks.getReportsByPullRequest).not.toHaveBeenCalled();
    });

    it("returns reports after public repository access is established", async () => {
        const caller = createCaller(context as never);

        await expect(
            caller.getReportsByPullRequest({
                provider: "gh",
                repository: "owner/public-repo",
                prNumber: 7,
            }),
        ).resolves.toEqual([{ id: 1 }]);
        expect(mocks.getReportsByPullRequest).toHaveBeenCalledWith(context.db, {
            provider: "github",
            repository: "owner/public-repo",
            prNumber: 7,
        });
    });
});
