import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub the DB and Next request-scope modules so importing repo-cache.ts
// doesn't try to open a real postgres connection during test load. The db
// object is a no-op query-builder chain that records what getCachedRepoData
// issues; each test controls the row the select chain resolves to.
type RepoCacheRow =
    | {
          repo: { rawData: unknown; lastSynced: Date | null };
          account: { username: string };
      }
    | {
          permission: "read" | "triage" | "write" | "maintain" | "admin" | null;
      }
    | { rawData: unknown; lastSynced: Date | null };

const { dbMock, afterMock, limitMock, returningMock, whereCalls } = vi.hoisted(
    () => {
        const limit = vi.fn(async (): Promise<RepoCacheRow[]> => []);
        const returning = vi.fn(async () => [{ id: 1 }]);
        const whereCalls: unknown[][] = [];
        const chain = {
            innerJoin: vi.fn(() => chain),
            where: vi.fn((...args: unknown[]) => {
                whereCalls.push(args);
                return { limit };
            }),
        };
        return {
            dbMock: {
                select: vi.fn(() => ({
                    from: vi.fn(() => chain),
                })),
                insert: vi.fn(() => ({
                    values: vi.fn(() => ({
                        onConflictDoUpdate: vi.fn(() => ({ returning })),
                    })),
                })),
            },
            afterMock: vi.fn(),
            limitMock: limit,
            returningMock: returning,
            whereCalls,
        };
    },
);

vi.mock("next/server", () => ({ after: afterMock }));
vi.mock("~/server/db", () => ({ db: dbMock }));

import type { CachedRepoSource } from "./repo-cache";
import {
    getCachedRepoData,
    getRepoPermissionForUser,
    viewerRepoAccess,
} from "./repo-cache";

const payload = { id: 7, name: "repo-7", description: "cached" };

function makeSource(
    overrides: Partial<CachedRepoSource<typeof payload>> = {},
): CachedRepoSource<typeof payload> {
    return {
        provider: "github",
        owner: "owner",
        repo: "repo-7",
        staleAfterMs: 5 * 60 * 1000,
        fetcher: async () => payload,
        toRepo: (p) => ({
            providerId: p.id,
            name: p.name,
            visibility: "public" as const,
            description: p.description,
            stars: 0,
            watchers: 0,
            forks: 0,
            defaultBranch: null,
            archived: false,
            owner: {
                providerId: 1,
                login: "owner",
                avatarUrl: null,
                type: "user",
            },
        }),
        ...overrides,
    };
}

beforeEach(() => {
    dbMock.select.mockClear();
    dbMock.insert.mockClear();
    afterMock.mockClear();
    whereCalls.length = 0;
    limitMock.mockReset();
    limitMock.mockResolvedValue([]);
    returningMock.mockReset();
    returningMock.mockResolvedValue([{ id: 1 }]);
});

describe("getCachedRepoData", () => {
    it("serves a fresh cached row from raw_data without fetching", async () => {
        limitMock.mockResolvedValueOnce([
            {
                repo: { rawData: payload, lastSynced: new Date() },
                account: { username: "owner" },
            },
        ]);

        const fetcher = vi.fn(async () => payload);
        const result = await getCachedRepoData(makeSource({ fetcher }));

        expect(result).toEqual(payload);
        expect(fetcher).not.toHaveBeenCalled();
        expect(dbMock.insert).not.toHaveBeenCalled();
    });

    it("serves a stale row and revalidates in the background", async () => {
        const staleRow = {
            repo: {
                rawData: payload,
                lastSynced: new Date(Date.now() - 10 * 60 * 1000),
            },
            account: { username: "owner" },
        };
        // First select: the served read (full-row shape). Second select: the
        // recheck inside the after() callback, which selects only the repo
        // fields (flat shape) and sees the row is still stale.
        limitMock.mockResolvedValueOnce([staleRow]);
        limitMock.mockResolvedValueOnce([
            {
                lastSynced: new Date(Date.now() - 10 * 60 * 1000),
                rawData: payload,
            },
        ]);

        const fetcher = vi.fn(async () => payload);
        const result = await getCachedRepoData(makeSource({ fetcher }));

        expect(result).toEqual(payload);
        expect(fetcher).not.toHaveBeenCalled();
        expect(afterMock).toHaveBeenCalledTimes(1);

        // The scheduled callback fires the recheck + refresh asynchronously.
        const revalidate = afterMock.mock.calls[0]?.[0] as () => void;
        revalidate();
        await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

        // Account + repo rows are upserted by the revalidation.
        expect(dbMock.insert).toHaveBeenCalledTimes(2);
    });

    it("skips the background fetch when another request already refreshed", async () => {
        limitMock.mockResolvedValueOnce([
            {
                repo: {
                    rawData: payload,
                    lastSynced: new Date(Date.now() - 10 * 60 * 1000),
                },
                account: { username: "owner" },
            },
        ]);
        // The recheck observes a newer lastSynced with a fresh payload
        // (flat shape: the recheck selects only the repo fields).
        const freshPayload = { id: 7, name: "repo-7", description: "fresh" };
        limitMock.mockResolvedValueOnce([
            { lastSynced: new Date(), rawData: freshPayload },
        ]);

        const fetcher = vi.fn(async () => payload);
        await getCachedRepoData(makeSource({ fetcher }));

        const revalidate = afterMock.mock.calls[0]?.[0] as () => void;
        revalidate();
        // The recheck runs a second select before deciding to skip.
        await vi.waitFor(() => expect(dbMock.select).toHaveBeenCalledTimes(2));

        expect(fetcher).not.toHaveBeenCalled();
        expect(dbMock.insert).not.toHaveBeenCalled();
    });

    it("looks up the cache row case-insensitively by provider, owner, repo", async () => {
        limitMock.mockResolvedValueOnce([
            {
                repo: { rawData: payload, lastSynced: new Date() },
                account: { username: "Owner" },
            },
        ]);

        await getCachedRepoData(makeSource({ owner: "OwNeR", repo: "RePo-7" }));

        const condition = whereCalls[0]?.[0] as SQL;
        const { sql: text, params } = new PgDialect().sqlToQuery(condition);
        expect(params).toEqual(
            expect.arrayContaining(["github", "owner", "repo-7"]),
        );
        expect(text).toContain('lower("account"."username")');
        expect(text).toContain('lower("repo"."name")');
    });

    it("fetches fresh when the cache read fails", async () => {
        limitMock.mockRejectedValue(new Error("select exploded"));

        const fetcher = vi.fn(async () => payload);
        const result = await getCachedRepoData(makeSource({ fetcher }));

        expect(result).toEqual(payload);
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("serves the fetched payload when the cache write fails", async () => {
        returningMock.mockRejectedValue(new Error("db down"));

        const fetcher = vi.fn(async () => payload);
        const result = await getCachedRepoData(makeSource({ fetcher }));

        expect(result).toEqual(payload);
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("treats a row with null raw_data as a miss and refetches", async () => {
        // GraphQL-synced rows store no REST payload.
        limitMock.mockResolvedValueOnce([
            {
                repo: { rawData: null, lastSynced: new Date() },
                account: { username: "owner" },
            },
        ]);

        const fetcher = vi.fn(async () => payload);
        const result = await getCachedRepoData(makeSource({ fetcher }));

        expect(result).toEqual(payload);
        expect(fetcher).toHaveBeenCalledTimes(1);
        // Account + repo rows are upserted on the miss path.
        expect(dbMock.insert).toHaveBeenCalledTimes(2);
    });

    it("fetches and upserts when no repo row exists", async () => {
        const fetcher = vi.fn(async () => payload);
        const result = await getCachedRepoData(makeSource({ fetcher }));

        expect(result).toEqual(payload);
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(dbMock.insert).toHaveBeenCalledTimes(2);
        expect(dbMock.select).toHaveBeenCalledTimes(1);
    });

    it("propagates a not-found fetcher result", async () => {
        const fetcher = vi.fn(async () => null);
        await expect(
            getCachedRepoData(makeSource({ fetcher })),
        ).rejects.toThrow("Repo not found");
        expect(dbMock.insert).not.toHaveBeenCalled();
    });
});

describe("getRepoPermissionForUser", () => {
    it("returns null without querying when the viewer has no username", async () => {
        const permission = await getRepoPermissionForUser(
            "github",
            null,
            "owner",
            "repo-7",
        );

        expect(permission).toBeNull();
        expect(dbMock.select).not.toHaveBeenCalled();
    });

    it("returns the effective permission from the view", async () => {
        limitMock.mockResolvedValueOnce([{ permission: "admin" }]);

        const permission = await getRepoPermissionForUser(
            "github",
            "alice",
            "owner",
            "repo-7",
        );

        expect(permission).toBe("admin");
        expect(dbMock.select).toHaveBeenCalledTimes(1);
    });

    it("returns null when the view has no grant", async () => {
        const permission = await getRepoPermissionForUser(
            "github",
            "alice",
            "owner",
            "repo-7",
        );

        expect(permission).toBeNull();
    });
});

describe("viewerRepoAccess", () => {
    const payload = { owner: { login: "owner" }, private: true };

    it("grants the owner admin and write even without a view grant", () => {
        expect(
            viewerRepoAccess({
                username: "owner",
                payload,
                permission: null,
            }),
        ).toEqual({ canView: true, admin: true, write: true });
    });

    it("matches an owner whose casing differs from the payload login", () => {
        expect(
            viewerRepoAccess({
                username: "OWNER",
                payload,
                permission: null,
            }),
        ).toEqual({ canView: true, admin: true, write: true });
    });

    it("denies a private repo when the viewer has no grant", () => {
        expect(
            viewerRepoAccess({
                username: "alice",
                payload,
                permission: null,
            }),
        ).toEqual({ canView: false, admin: false, write: false });
    });

    it("admits a read-only viewer of a private repo without admin or write", () => {
        expect(
            viewerRepoAccess({
                username: "alice",
                payload,
                permission: "read",
            }),
        ).toEqual({ canView: true, admin: false, write: false });
    });

    it("grants write access for a write permission", () => {
        expect(
            viewerRepoAccess({
                username: "alice",
                payload,
                permission: "write",
            }),
        ).toEqual({ canView: true, admin: false, write: true });
    });

    it("marks an admin grant as admin and write", () => {
        expect(
            viewerRepoAccess({
                username: "alice",
                payload,
                permission: "admin",
            }),
        ).toEqual({ canView: true, admin: true, write: true });
    });

    it("never gates a public repo", () => {
        expect(
            viewerRepoAccess({
                username: null,
                payload: { owner: { login: "owner" }, private: false },
                permission: null,
            }),
        ).toEqual({ canView: true, admin: false, write: false });
    });
});
