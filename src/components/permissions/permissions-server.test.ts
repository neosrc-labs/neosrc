import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getLinkedAccount: vi.fn(),
    getSession: vi.fn(),
    isAnonymousToken: vi.fn(),
    getUserRepoPermission: vi.fn(),
    getRepoPermissionForUser: vi.fn(),
}));

vi.mock("~/server/auth", () => ({
    getLinkedAccount: mocks.getLinkedAccount,
    getSession: mocks.getSession,
    isAnonymousToken: mocks.isAnonymousToken,
}));
vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/server/github", () => ({
    getUserRepoPermission: mocks.getUserRepoPermission,
}));
vi.mock("~/server/repo-cache", () => ({
    getRepoPermissionForUser: mocks.getRepoPermissionForUser,
}));

import { getIssuePermissionContext } from "./permissions-server";

const OWNER = "neosrc-labs";
const REPO = "neosrc";
const USER_ID = "user-1";

function context(
    overrides: { accessToken?: string; author?: string | null } = {},
) {
    return getIssuePermissionContext({
        provider: "gh",
        accessToken: overrides.accessToken ?? "ghu_viewer",
        owner: OWNER,
        repo: REPO,
        subjectPromise: Promise.resolve({
            locked: false,
            user: { login: overrides.author ?? "someone-else" },
        }),
        userId: USER_ID,
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({
        user: { id: USER_ID },
    });
    mocks.getLinkedAccount.mockResolvedValue({
        providerId: "github",
        username: "ranger-ross",
        connectionStatus: "active",
    });
    mocks.isAnonymousToken.mockReturnValue(false);
});

describe("GitHub viewer permission", () => {
    it("falls back to the synced grants when the token cannot read collaborators", async () => {
        // The shared anonymous token has no `repo` scope, so GitHub answers
        // 403 for the collaborator lookup. That says nothing about access.
        mocks.getUserRepoPermission.mockRejectedValue(
            Object.assign(new Error("Must have push access"), { status: 403 }),
        );
        mocks.getRepoPermissionForUser.mockResolvedValue("admin");

        const permissionContext = await context();

        expect(permissionContext.repoPermission).toBe("admin");
        expect(permissionContext.currentUser).toBe("ranger-ross");
        expect(mocks.getRepoPermissionForUser).toHaveBeenCalledWith(
            "github",
            "ranger-ross",
            OWNER,
            REPO,
        );
    });

    it("skips the collaborator lookup for the anonymous browsing token", async () => {
        mocks.isAnonymousToken.mockReturnValue(true);
        mocks.getRepoPermissionForUser.mockResolvedValue("write");

        const permissionContext = await context({ accessToken: "anon-pat" });

        expect(permissionContext.repoPermission).toBe("write");
        expect(mocks.getUserRepoPermission).not.toHaveBeenCalled();
    });

    it("keeps a definite no-access answer from the collaborator lookup", async () => {
        mocks.getUserRepoPermission.mockResolvedValue("none");

        const permissionContext = await context();

        expect(permissionContext.repoPermission).toBe("none");
        expect(mocks.getRepoPermissionForUser).not.toHaveBeenCalled();
    });

    it("maps a synced maintain grant to write", async () => {
        mocks.isAnonymousToken.mockReturnValue(true);
        mocks.getRepoPermissionForUser.mockResolvedValue("maintain");

        const permissionContext = await context({ accessToken: "anon-pat" });

        expect(permissionContext.repoPermission).toBe("write");
    });

    it("leaves the permission unresolved when neither source answers", async () => {
        mocks.getUserRepoPermission.mockRejectedValue(new Error("boom"));
        mocks.getRepoPermissionForUser.mockResolvedValue(null);

        const permissionContext = await context();

        expect(permissionContext.repoPermission).toBeNull();
        expect(permissionContext.currentUser).toBe("ranger-ross");
    });

    it("treats an unlinked session as anonymous without calling GitHub", async () => {
        mocks.getLinkedAccount.mockResolvedValue(undefined);
        const permissionContext = await context();

        expect(permissionContext).toEqual({
            currentUser: null,
            repoPermission: null,
            isPullRequestLocked: false,
            isPullRequestAuthor: false,
            provider: "gh",
        });
        expect(mocks.getUserRepoPermission).not.toHaveBeenCalled();
    });

    it("treats an account requiring reauthentication as unlinked", async () => {
        mocks.getLinkedAccount.mockResolvedValue({
            providerId: "github",
            username: "ranger-ross",
            connectionStatus: "reauth_required",
        });

        const permissionContext = await context();

        expect(permissionContext).toEqual({
            currentUser: null,
            repoPermission: null,
            isPullRequestLocked: false,
            isPullRequestAuthor: false,
            provider: "gh",
        });
        expect(mocks.getUserRepoPermission).not.toHaveBeenCalled();
        expect(mocks.getRepoPermissionForUser).not.toHaveBeenCalled();
    });

    it("still resolves the author flag when the permission lookup fails", async () => {
        mocks.getUserRepoPermission.mockRejectedValue(new Error("boom"));
        mocks.getRepoPermissionForUser.mockResolvedValue(null);

        const permissionContext = await context({ author: "ranger-ross" });

        expect(permissionContext.isPullRequestAuthor).toBe(true);
    });
});
