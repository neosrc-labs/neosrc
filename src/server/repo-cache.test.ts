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
      };

const { dbMock, afterMock, limitMock, returningMock } = vi.hoisted(() => {
    const limit = vi.fn(async (): Promise<RepoCacheRow[]> => []);
    const returning = vi.fn(async () => [{ id: 1 }]);
    const chain = {
        innerJoin: vi.fn(() => chain),
        where: vi.fn(() => ({ limit })),
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
    };
});

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

    it("serves a stale row and schedules background revalidation", async () => {
        limitMock.mockResolvedValueOnce([
            {
                repo: {
                    rawData: payload,
                    lastSynced: new Date(Date.now() - 10 * 60 * 1000),
                },
                account: { username: "owner" },
            },
        ]);

        const fetcher = vi.fn(async () => payload);
        const result = await getCachedRepoData(makeSource({ fetcher }));

        expect(result).toEqual(payload);
        expect(fetcher).not.toHaveBeenCalled();
        expect(afterMock).toHaveBeenCalledTimes(1);
        expect(dbMock.insert).not.toHaveBeenCalled();
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

    it("grants the owner admin and access even without a view grant", () => {
        expect(
            viewerRepoAccess({
                username: "owner",
                payload,
                permission: null,
            }),
        ).toEqual({ canView: true, admin: true });
    });

    it("denies a private repo when the viewer has no grant", () => {
        expect(
            viewerRepoAccess({
                username: "alice",
                payload,
                permission: null,
            }),
        ).toEqual({ canView: false, admin: false });
    });

    it("admits a granted viewer of a private repo without admin", () => {
        expect(
            viewerRepoAccess({
                username: "alice",
                payload,
                permission: "read",
            }),
        ).toEqual({ canView: true, admin: false });
    });

    it("marks an admin grant as admin", () => {
        expect(
            viewerRepoAccess({
                username: "alice",
                payload,
                permission: "admin",
            }),
        ).toEqual({ canView: true, admin: true });
    });

    it("never gates a public repo", () => {
        expect(
            viewerRepoAccess({
                username: null,
                payload: { owner: { login: "owner" }, private: false },
                permission: null,
            }),
        ).toEqual({ canView: true, admin: false });
    });
});
