import { graphql as octokitGraphql } from "@octokit/graphql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getUser as getCodebergUser } from "~/server/codeberg";
import * as schema from "~/server/db/schema";
import { createOctokit, getAuthenticatedUser } from "~/server/github";

// Network modules are stubbed so the flows only exercise fetch -> hash ->
// compare -> write logic. The incremental-state accessors (getStoredSyncState
// / storeSyncState) are the REAL implementations, run against the injected db
// stand-in below, so the permissionsSyncState SQL stays covered.
vi.mock("@octokit/graphql", () => ({
    graphql: { defaults: vi.fn() },
}));
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

import { syncCurrentUser } from "~/server/sync";
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
const graphqlDefaultsMock = vi.mocked(octokitGraphql.defaults);

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

/**
 * Minimal db/tx stand-in: the flows touch transaction, execute, insert,
 * delete, and select. The permissions_sync_state insert and the state select
 * are wired to a shared `state` object so the REAL getStoredSyncState /
 * storeSyncState run end to end.
 */
function makeDb() {
    const state = {
        row: null as {
            snapshotHash: string;
            updatedAt: Date;
            snapshotFetchedAt?: Date | null;
        } | null,
    };
    const selectImpl = () => ({
        from: vi.fn(() => ({
            where: vi.fn(() => ({
                limit: vi.fn(async () =>
                    state.row
                        ? [
                              {
                                  snapshotHash: state.row.snapshotHash,
                                  updatedAt: state.row.updatedAt,
                                  snapshotFetchedAt:
                                      state.row.snapshotFetchedAt ?? null,
                              },
                          ]
                        : [],
                ),
            })),
        })),
    });
    const insertImpl = (table: unknown) => {
        if (table === schema.permissionsSyncState) {
            return {
                values: vi.fn(
                    (values: {
                        snapshotHash: string;
                        snapshotFetchedAt: Date;
                    }) => {
                        state.row = {
                            snapshotHash: values.snapshotHash,
                            // Backdated past the recency window so later polls
                            // exercise the hash gate, not the recency gate.
                            updatedAt: new Date(Date.now() - 6 * 60 * 1000),
                            snapshotFetchedAt: values.snapshotFetchedAt,
                        };
                        return { onConflictDoUpdate: vi.fn(async () => {}) };
                    },
                ),
            };
        }
        return insertChain();
    };
    const executor = {
        insert: vi.fn(insertImpl),
        delete: vi.fn(() => deleteChain()),
        select: vi.fn(selectImpl),
        execute: vi.fn(async () => {}),
    };
    const db = {
        transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
            fn(executor),
        ),
        execute: vi.fn(async () => {}),
        select: vi.fn(selectImpl),
        insert: vi.fn(insertImpl),
    };
    return { executor, db, state };
}

function githubRepo(
    id: number,
    permission: "admin" | "read" | null,
): GitHubSyncRepo {
    return {
        providerId: id,
        name: `repo-${id}`,
        visibility: "public",
        description: null,
        stars: 0,
        watchers: 0,
        forks: 0,
        defaultBranch: null,
        archived: false,
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
        visibility: "public",
        description: null,
        stars: 0,
        watchers: 0,
        forks: 0,
        defaultBranch: null,
        archived: false,
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
            listForAuthenticatedUser: vi.fn(async () => ({
                data: [] as unknown[],
            })),
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

    it("change when the repo owner changes", () => {
        const ownedByOwner = githubRepo(1, "admin");
        const ownedBySomeoneElse = {
            ...githubRepo(1, "admin"),
            owner: {
                providerId: 99,
                login: "elsewhere",
                avatarUrl: null,
                type: "org" as const,
            },
        };
        expect(githubSnapshotHash([ownedByOwner], [], [])).not.toBe(
            githubSnapshotHash([ownedBySomeoneElse], [], []),
        );
        expect(codebergSnapshotHash([syncRepo(1, "admin")], [])).not.toBe(
            codebergSnapshotHash(
                [
                    {
                        ...syncRepo(1, "admin"),
                        owner: {
                            providerId: 99,
                            login: "elsewhere",
                            avatarUrl: null,
                            type: "org",
                        },
                    },
                ],
                [],
            ),
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

    beforeEach(() => {
        vi.clearAllMocks();
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
        const { db, executor, state } = makeDb();
        const result = await syncCurrentUserGitHub(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: false,
            forceFull: false,
        });

        expect(db.transaction).toHaveBeenCalledTimes(1);
        expect(executor.execute).toHaveBeenCalledTimes(1); // advisory lock
        expect(db.execute).toHaveBeenCalledTimes(1); // refreshPermissionsView
        expect(result.accountsUpserted).toBe(1); // the user account row
        expect(state.row).not.toBeNull();
    });

    it("skips all writes when the snapshot hash matches the stored one", async () => {
        const { db, state } = makeDb();
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
        expect(state.row).not.toBeNull();
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
    });

    it("short-circuits without fetching inputs when the last sync is fresh", async () => {
        const { db, state } = makeDb();
        state.row = { snapshotHash: "h", updatedAt: new Date() };

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
        const { db, state } = makeDb();
        await syncCurrentUserGitHub(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: false,
            forceFull: false,
        });
        const writesAfterFirst = db.transaction.mock.calls.length;
        state.row = {
            snapshotHash: state.row!.snapshotHash,
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
        const { db, state } = makeDb();
        await syncCurrentUserGitHub(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: false,
            forceFull: false,
        });
        const writesAfterFirst = db.transaction.mock.calls.length;
        state.row = {
            snapshotHash: state.row!.snapshotHash,
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
        expect(result.reposUpserted).toBe(1);
        expect(result.relationsWritten).toBe(1);
    });

    it("refuses to restore access from a snapshot older than the applied one", async () => {
        const { db, executor, state } = makeDb();
        // A newer sync already committed under the lock, having read its
        // snapshot in the future relative to this run.
        const newerFetchedAt = new Date(Date.now() + 60_000);
        state.row = {
            snapshotHash: "newer-hash",
            updatedAt: new Date(Date.now() - 6 * 60 * 1000),
            snapshotFetchedAt: newerFetchedAt,
        };
        // This older run still sees a grant the newer sync had revoked.
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

        // forceFull bypasses the recency and hash gates, so only the ordering
        // guard under the lock can stop the stale write.
        const result = await syncCurrentUserGitHub(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: false,
            forceFull: true,
        });

        expect(executor.execute).toHaveBeenCalledTimes(1); // lock acquired
        expect(executor.insert).not.toHaveBeenCalled(); // no upserts or store
        expect(executor.delete).not.toHaveBeenCalled(); // relations untouched
        expect(db.execute).not.toHaveBeenCalled(); // no view refresh
        expect(result).toEqual(EMPTY_RESULT);
        expect(state.row?.snapshotFetchedAt).toEqual(newerFetchedAt);
    });

    it("does not commit sync state when a team fetch was skipped", async () => {
        octokit.teams.listForAuthenticatedUser.mockResolvedValue({
            data: [
                {
                    id: 9,
                    slug: "team",
                    name: "team",
                    organization: {
                        id: 5,
                        login: "org",
                        avatar_url: null,
                    },
                },
            ],
        });
        graphqlDefaultsMock.mockReturnValue(
            vi.fn().mockRejectedValue(new Error("graphql down")) as never,
        );
        const { db, state } = makeDb();

        const result = await syncCurrentUserGitHub(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: false,
            forceFull: false,
        });

        expect(result.teamsSkipped).toBe(1);
        expect(state.row).toBeNull();
    });

    it("leaves team relations untouched when a team fetch was skipped", async () => {
        octokit.teams.listForAuthenticatedUser.mockResolvedValue({
            data: [
                {
                    id: 9,
                    slug: "team",
                    name: "team",
                    organization: {
                        id: 5,
                        login: "org",
                        avatar_url: null,
                    },
                },
            ],
        });
        const graphqlCall = vi
            .fn()
            .mockResolvedValueOnce({
                viewer: {
                    organization: {
                        team: {
                            repositories: {
                                pageInfo: {
                                    hasNextPage: false,
                                    endCursor: null,
                                },
                                edges: [
                                    {
                                        permission: "ADMIN",
                                        node: {
                                            databaseId: 77,
                                            name: "team-repo",
                                            description: null,
                                            isPrivate: false,
                                            isArchived: false,
                                            stargazerCount: 0,
                                            forkCount: 0,
                                            watchers: { totalCount: 0 },
                                            defaultBranchRef: null,
                                            owner: {
                                                __typename: "Organization",
                                                login: "org",
                                                avatarUrl: null,
                                                databaseId: 5,
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            })
            .mockRejectedValueOnce(new Error("rate limited"));
        graphqlDefaultsMock.mockReturnValue(graphqlCall as never);
        const { db, executor, state } = makeDb();

        await syncCurrentUserGitHub(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: false,
            forceFull: false,
        });
        expect(state.row).not.toBeNull();
        const storedHash = state.row!.snapshotHash;
        const deletesAfterFullSync = executor.delete.mock.calls.length;
        const relationBatches = (): string[][] =>
            executor.insert.mock.calls
                .map((args, i) => ({
                    table: args[0],
                    chain: executor.insert.mock.results[i]!.value,
                }))
                .filter(({ table }) => table === schema.relation)
                .map(
                    ({ chain }) =>
                        (
                            chain.values.mock.calls[0]?.[0] as
                                | Array<{ subjectType: string }>
                                | undefined
                        )?.map((row) => row.subjectType) ?? [],
                );
        // Sanity: the full sync wrote the team's grant edges.
        expect(relationBatches()[0]).toContain("team");

        // A changed snapshot forces a second sync whose per-team fetch fails.
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

        const result = await syncCurrentUserGitHub(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: false,
            forceFull: false,
        });

        expect(result.teamsSkipped).toBe(1);
        // Only the user-subject replace ran; the team-subject rows written by
        // the first sync were not deleted.
        expect(executor.delete).toHaveBeenCalledTimes(deletesAfterFullSync + 1);
        // And no partial team rows were re-inserted on top of them.
        expect(relationBatches()[1]).not.toContain("team");
        // Sync state stays unstored so the next poll retries the team.
        expect(state.row?.snapshotHash).toBe(storedHash);
        // The user-subject portion still applies, so the view refreshes.
        expect(db.execute).toHaveBeenCalledTimes(2);
    });

    it("propagates a profile fetch failure without writing", async () => {
        getAuthenticatedUserMock.mockRejectedValue(new Error("api down"));
        const { db } = makeDb();

        await expect(
            syncCurrentUserGitHub(db as never, {
                accessToken: "tok",
                userId: "u1",
                forceRecent: false,
                forceFull: false,
            }),
        ).rejects.toThrow("api down");
        expect(db.transaction).not.toHaveBeenCalled();
    });
});

describe("syncCurrentUserCodeberg incremental gate", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCodebergUserMock.mockResolvedValue({
            id: 42,
            login: "tester",
            avatar_url: null,
        } as never);
        // The repo/org fetchers hit the network; an unauthenticated response
        // yields empty snapshots. Non-OK responses now abort the sync, so the
        // stub returns empty bodies.
        vi.stubGlobal(
            "fetch",
            vi.fn(
                async () =>
                    ({
                        ok: true,
                        json: async () => [],
                    }) as unknown as Response,
            ),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("skips all writes on a second poll with an unchanged snapshot", async () => {
        const { db, state } = makeDb();

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
        expect(state.row).not.toBeNull();
    });

    it("refuses to restore access from a snapshot older than the applied one", async () => {
        const { db, executor, state } = makeDb();
        // A newer sync already committed under the lock, having read its
        // snapshot in the future relative to this run.
        const newerFetchedAt = new Date(Date.now() + 60_000);
        state.row = {
            snapshotHash: "newer-hash",
            updatedAt: new Date(Date.now() - 6 * 60 * 1000),
            snapshotFetchedAt: newerFetchedAt,
        };

        // forceFull bypasses the recency and hash gates, so only the ordering
        // guard under the lock can stop the stale write.
        const result = await syncCurrentUserCodeberg(db as never, {
            accessToken: "tok",
            userId: "u1",
            forceRecent: false,
            forceFull: true,
        });

        expect(executor.execute).toHaveBeenCalledTimes(1); // lock acquired
        expect(executor.insert).not.toHaveBeenCalled(); // no upserts or store
        expect(executor.delete).not.toHaveBeenCalled(); // relations untouched
        expect(db.execute).not.toHaveBeenCalled(); // no view refresh
        expect(result).toEqual(EMPTY_RESULT);
        expect(state.row?.snapshotFetchedAt).toEqual(newerFetchedAt);
    });

    it("short-circuits without fetching inputs when the last sync is fresh", async () => {
        const { db, state } = makeDb();
        state.row = { snapshotHash: "h", updatedAt: new Date() };

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

    it("aborts before writing when an upstream fetch fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(
                async () => ({ ok: false, status: 500 }) as unknown as Response,
            ),
        );
        const { db } = makeDb();

        await expect(
            syncCurrentUserCodeberg(db as never, {
                accessToken: "tok",
                userId: "u1",
                forceRecent: false,
                forceFull: false,
            }),
        ).rejects.toThrow("failed with status 500");
        expect(db.transaction).not.toHaveBeenCalled();
    });
});

describe("syncCurrentUser dispatch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createOctokitMock.mockReturnValue(makeOctokitMock() as never);
        getAuthenticatedUserMock.mockResolvedValue({
            id: 42,
            login: "tester",
            avatar_url: null,
        } as never);
        getCodebergUserMock.mockResolvedValue({
            id: 42,
            login: "tester",
            avatar_url: null,
        } as never);
        vi.stubGlobal(
            "fetch",
            vi.fn(
                async () =>
                    ({
                        ok: true,
                        json: async () => [],
                    }) as unknown as Response,
            ),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("routes github inputs to the github flow", async () => {
        const { db } = makeDb();

        const result = await syncCurrentUser(db as never, {
            provider: "github",
            accessToken: "tok",
            userId: "u1",
        });

        expect(getAuthenticatedUserMock).toHaveBeenCalled();
        expect(result.accountsUpserted).toBe(1);
    });

    it("routes codeberg inputs to the codeberg flow", async () => {
        const { db } = makeDb();

        const result = await syncCurrentUser(db as never, {
            provider: "codeberg",
            accessToken: "tok",
            userId: "u1",
        });

        expect(getCodebergUserMock).toHaveBeenCalled();
        expect(result.accountsUpserted).toBe(1);
    });

    it("defaults forceRecent and forceFull to false (incremental by default)", async () => {
        const { db } = makeDb();

        await syncCurrentUser(db as never, {
            provider: "github",
            accessToken: "tok",
            userId: "u1",
        });
        // The stored state is backdated, so the second poll reaches the hash
        // gate and, with an unchanged snapshot, writes nothing.
        const second = await syncCurrentUser(db as never, {
            provider: "github",
            accessToken: "tok",
            userId: "u1",
        });

        expect(second).toEqual(EMPTY_RESULT);
    });
});
