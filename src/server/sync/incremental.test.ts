import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getUser as getCodebergUser } from "~/server/codeberg";
import { createOctokit, getAuthenticatedUser } from "~/server/github";
import { getStoredSyncState, storeSyncState } from "~/server/sync/shared";

// Network modules are stubbed so the flows only exercise fetch -> hash ->
// compare -> write logic.
vi.mock("~/server/github", () => ({
    createOctokit: vi.fn(),
    getGitHubUser: vi.fn(),
    getAuthenticatedUser: vi.fn(),
}));
vi.mock("~/server/codeberg", () => ({
    CODEBERG_API: "https://codeberg.org",
    getUser: vi.fn(),
    getUserByUsername: vi.fn(),
}));
// Keep the real write helpers (they operate on the injected executor) but
// replace the two incremental-state accessors.
vi.mock("~/server/sync/shared", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("~/server/sync/shared")>();
    return {
        ...actual,
        getStoredSyncState: vi.fn(),
        storeSyncState: vi.fn(),
    };
});

import {
    codebergSnapshotHash,
    syncCurrentUserCodeberg,
} from "~/server/sync/codeberg";
import {
    type GitHubSyncRepo,
    githubSnapshotHash,
    syncCurrentUserGitHub,
} from "~/server/sync/github";
import type { SyncRepo } from "~/server/sync/shared";

const getAuthenticatedUserMock = vi.mocked(getAuthenticatedUser);
const createOctokitMock = vi.mocked(createOctokit);
const getCodebergUserMock = vi.mocked(getCodebergUser);
const getStoredSyncStateMock = vi.mocked(getStoredSyncState);
const storeSyncStateMock = vi.mocked(storeSyncState);

const EMPTY_RESULT = {
    accountsUpserted: 0,
    reposUpserted: 0,
    relationsWritten: 0,
    relationsRemoved: 0,
    teamsSkipped: 0,
};

/** Chainable drizzle-style insert mock resolving to a single row. */
function insertChain() {
    const chain = {
        values: vi.fn(() => chain),
        onConflictDoUpdate: vi.fn(() => chain),
        onConflictDoNothing: vi.fn(() => chain),
        returning: vi.fn(async () => [{ id: 1 }]),
    };
    return chain;
}

function deleteChain() {
    const chain = {
        returning: vi.fn(async () => [{ id: 1 }]),
    };
    return { where: vi.fn(() => chain) };
}

/** Minimal db/tx stand-in: the flows only touch transaction + execute. */
function makeDb() {
    const executor = {
        insert: vi.fn(() => insertChain()),
        delete: vi.fn(() => deleteChain()),
    };
    return {
        executor,
        db: {
            transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
                fn(executor),
            ),
            execute: vi.fn(async () => {}),
        },
    };
}

function githubRepo(
    id: number,
    permission: "admin" | "read" | null,
): GitHubSyncRepo {
    return {
        providerId: id,
        name: `repo-${id}`,
        private: false,
        owner: { providerId: 1, login: "owner", avatarUrl: null, type: "org" },
        permissions: permission
            ? {
                  admin: permission === "admin",
                  maintain: false,
                  push: false,
                  triage: false,
                  pull: permission === "read",
              }
            : null,
        rawData: null,
    };
}

function syncRepo(id: number, permission: "admin" | "read" | null): SyncRepo {
    return {
        providerId: id,
        name: `repo-${id}`,
        owner: { providerId: 1, login: "owner", avatarUrl: null, type: "org" },
        permissions: permission
            ? {
                  admin: permission === "admin",
                  maintain: false,
                  push: false,
                  triage: false,
                  pull: permission === "read",
              }
            : null,
        rawData: null,
    };
}

function makeOctokitMock() {
    return {
        repos: {
            listForAuthenticatedUser: vi.fn(async () => ({
                data: [] as unknown[],
            })),
            listForOrg: vi.fn(),
            listForUser: vi.fn(),
        },
        orgs: {
            listMembershipsForAuthenticatedUser: vi.fn(async () => ({
                data: [],
            })),
        },
        teams: {
            listForAuthenticatedUser: vi.fn(async () => ({ data: [] })),
        },
    };
}

describe("snapshot hashes", () => {
    it("are order-insensitive", () => {
        const a = [githubRepo(1, "admin"), githubRepo(2, "read")];
        const b = [githubRepo(2, "read"), githubRepo(1, "admin")];
        expect(githubSnapshotHash(a, [], [])).toBe(
            githubSnapshotHash(b, [], []),
        );
    });

    it("change when a permission changes", () => {
        expect(githubSnapshotHash([githubRepo(1, "admin")], [], [])).not.toBe(
            githubSnapshotHash([githubRepo(1, "read")], [], []),
        );
    });

    it("include memberships and teams", () => {
        expect(githubSnapshotHash([], [], [])).not.toBe(
            githubSnapshotHash(
                [],
                [
                    {
                        providerId: 5,
                        login: "org",
                        avatarUrl: null,
                        role: "member",
                    },
                ],
                [],
            ),
        );
        expect(githubSnapshotHash([], [], [])).not.toBe(
            githubSnapshotHash(
                [],
                [],
                [
                    {
                        providerId: 9,
                        slug: "team",
                        name: "team",
                        org: { providerId: 5, login: "org", avatarUrl: null },
                    },
                ],
            ),
        );
    });

    it("hashes codeberg repos and orgs order-insensitively", () => {
        const a = [syncRepo(1, "admin"), syncRepo(2, "read")];
        const b = [syncRepo(2, "read"), syncRepo(1, "admin")];
        expect(codebergSnapshotHash(a, [])).toBe(codebergSnapshotHash(b, []));
        expect(codebergSnapshotHash(a, [{ providerId: 7 }])).not.toBe(
            codebergSnapshotHash(a, []),
        );
    });
});

describe("syncCurrentUserGitHub incremental gate", () => {
    const octokit = makeOctokitMock();
    let stored: { snapshotHash: string; updatedAt: Date } | null = null;

    beforeEach(() => {
        stored = null;
        vi.clearAllMocks();
        getStoredSyncStateMock.mockImplementation(async () => stored);
        storeSyncStateMock.mockImplementation(
            async (_db, _provider, _userId, hash: string) => {
                stored = {
                    snapshotHash: hash,
                    // The stored sync is older than the recency window so the
                    // incremental tests exercise the hash gate rather than
                    // the recency gate.
                    updatedAt: new Date(Date.now() - 6 * 60 * 1000),
                };
            },
        );
        createOctokitMock.mockReturnValue(octokit as never);
        getAuthenticatedUserMock.mockResolvedValue({
            id: 42,
            login: "tester",
            avatar_url: null,
        } as never);
    });

    afterEach(() => {
        octokit.repos.listForAuthenticatedUser.mockResolvedValue({ data: [] });
    });

    it("performs a full sync on the first run and stores the snapshot hash", async () => {
        const { db } = makeDb();
        const result = await syncCurrentUserGitHub(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: false,
            forceFull: false,
        });

        expect(db.transaction).toHaveBeenCalledTimes(1);
        expect(db.execute).toHaveBeenCalledTimes(1); // refreshPermissionsView
        expect(storeSyncStateMock).toHaveBeenCalledTimes(1);
        expect(result.accountsUpserted).toBe(1); // the user account row
        expect(stored).not.toBeNull();
    });

    it("skips all writes when the snapshot hash matches the stored one", async () => {
        const { db } = makeDb();
        await syncCurrentUserGitHub(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: false,
            forceFull: false,
        });
        const writesAfterFirst = db.transaction.mock.calls.length;

        const result = await syncCurrentUserGitHub(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: false,
            forceFull: false,
        });

        expect(result).toEqual(EMPTY_RESULT);
        expect(db.transaction).toHaveBeenCalledTimes(writesAfterFirst);
        expect(db.execute).toHaveBeenCalledTimes(1);
        expect(storeSyncStateMock).toHaveBeenCalledTimes(1);
    });

    it("forceFull re-syncs even when the hash matches", async () => {
        const { db } = makeDb();
        await syncCurrentUserGitHub(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: false,
            forceFull: false,
        });
        const writesAfterFirst = db.transaction.mock.calls.length;

        await syncCurrentUserGitHub(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: false,
            forceFull: true,
        });

        expect(db.transaction).toHaveBeenCalledTimes(writesAfterFirst + 1);
        expect(storeSyncStateMock).toHaveBeenCalledTimes(2);
    });

    it("short-circuits without fetching inputs when the last sync is fresh", async () => {
        const { db } = makeDb();
        stored = { snapshotHash: "h", updatedAt: new Date() };

        const result = await syncCurrentUserGitHub(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: false,
            forceFull: false,
        });

        expect(result).toEqual(EMPTY_RESULT);
        expect(getAuthenticatedUserMock).not.toHaveBeenCalled();
        expect(octokit.repos.listForAuthenticatedUser).not.toHaveBeenCalled();
        expect(db.transaction).not.toHaveBeenCalled();
    });

    it("forceRecent fetches inputs despite a fresh sync but still hash-compares", async () => {
        const { db } = makeDb();
        await syncCurrentUserGitHub(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: false,
            forceFull: false,
        });
        const writesAfterFirst = db.transaction.mock.calls.length;
        stored = {
            snapshotHash: stored!.snapshotHash,
            updatedAt: new Date(),
        };

        const result = await syncCurrentUserGitHub(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: true,
            forceFull: false,
        });

        expect(getAuthenticatedUserMock).toHaveBeenCalledTimes(2);
        expect(result).toEqual(EMPTY_RESULT);
        expect(db.transaction).toHaveBeenCalledTimes(writesAfterFirst);
    });

    it("forceFull re-syncs even when the sync is fresh and the hash matches", async () => {
        const { db } = makeDb();
        await syncCurrentUserGitHub(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: false,
            forceFull: false,
        });
        const writesAfterFirst = db.transaction.mock.calls.length;
        stored = {
            snapshotHash: stored!.snapshotHash,
            updatedAt: new Date(),
        };

        const result = await syncCurrentUserGitHub(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: false,
            forceFull: true,
        });

        expect(db.transaction).toHaveBeenCalledTimes(writesAfterFirst + 1);
        expect(result.accountsUpserted).toBe(1);
    });

    it("re-syncs when the snapshot changed", async () => {
        const { db } = makeDb();
        await syncCurrentUserGitHub(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: false,
            forceFull: false,
        });
        octokit.repos.listForAuthenticatedUser.mockResolvedValue({
            data: [
                {
                    id: 7,
                    name: "granted",
                    private: false,
                    owner: {
                        id: 2,
                        login: "other",
                        avatar_url: null,
                        type: "User",
                    },
                    permissions: {
                        admin: false,
                        maintain: false,
                        push: false,
                        triage: false,
                        pull: true,
                    },
                },
            ],
        });
        const writesAfterFirst = db.transaction.mock.calls.length;

        const result = await syncCurrentUserGitHub(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: false,
            forceFull: false,
        });

        expect(db.transaction).toHaveBeenCalledTimes(writesAfterFirst + 1);
        expect(storeSyncStateMock).toHaveBeenCalledTimes(2);
        expect(result.reposUpserted).toBe(1);
        expect(result.relationsWritten).toBe(1);
    });
});

describe("syncCurrentUserCodeberg incremental gate", () => {
    let stored: { snapshotHash: string; updatedAt: Date } | null = null;

    beforeEach(() => {
        stored = null;
        vi.clearAllMocks();
        getStoredSyncStateMock.mockImplementation(async () => stored);
        storeSyncStateMock.mockImplementation(
            async (_db, _provider, _userId, hash: string) => {
                stored = {
                    snapshotHash: hash,
                    // Older than the recency window so the hash gate is
                    // exercised rather than the recency gate.
                    updatedAt: new Date(Date.now() - 6 * 60 * 1000),
                };
            },
        );
        getCodebergUserMock.mockResolvedValue({
            id: 42,
            login: "tester",
            avatar_url: null,
        } as never);
        // The repo/org fetchers hit the network; an unauthenticated response
        // yields empty snapshots.
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({ ok: false }) as Response),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("skips all writes on a second poll with an unchanged snapshot", async () => {
        const { db } = makeDb();

        const first = await syncCurrentUserCodeberg(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: false,
            forceFull: false,
        });
        const writesAfterFirst = db.transaction.mock.calls.length;
        const second = await syncCurrentUserCodeberg(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: false,
            forceFull: false,
        });

        expect(first.accountsUpserted).toBe(1);
        expect(second).toEqual(EMPTY_RESULT);
        expect(db.transaction).toHaveBeenCalledTimes(writesAfterFirst);
        expect(db.execute).toHaveBeenCalledTimes(1);
        expect(storeSyncStateMock).toHaveBeenCalledTimes(1);
    });

    it("short-circuits without fetching inputs when the last sync is fresh", async () => {
        const { db } = makeDb();
        stored = { snapshotHash: "h", updatedAt: new Date() };

        const result = await syncCurrentUserCodeberg(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: false,
            forceFull: false,
        });

        expect(result).toEqual(EMPTY_RESULT);
        expect(getCodebergUserMock).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
        expect(db.transaction).not.toHaveBeenCalled();
    });
});
