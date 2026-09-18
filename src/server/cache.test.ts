import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAndCache, searchCacheKey } from "~/server/cache";

// Stub the DB and Next request-scope modules so importing cache.ts doesn't try
// to open a real postgres connection during test load. The db object is a
// no-op query-builder chain that records what deleteExpiredCacheRows issues.
// Sweep tests reload the module dynamically because the module-level throttle
// must reset between those tests; static imports cannot provide that isolation.
const { dbMock, afterMock, deleteWhereMock, limitMock, upsertMock } =
    vi.hoisted(() => {
        const deleteWhere = vi.fn();
        const limit = vi.fn(async (): Promise<unknown[]> => []);
        const upsert = vi.fn(async () => {});
        return {
            dbMock: {
                delete: vi.fn(() => ({ where: deleteWhere })),
                select: vi.fn(() => ({
                    from: vi.fn(() => ({
                        where: vi.fn(() => ({ limit })),
                    })),
                })),
                insert: vi.fn(() => ({
                    values: vi.fn(() => ({
                        onConflictDoUpdate: upsert,
                    })),
                })),
            },
            afterMock: vi.fn(),
            deleteWhereMock: deleteWhere,
            limitMock: limit,
            upsertMock: upsert,
        };
    });

vi.mock("next/server", () => ({ after: afterMock }));
vi.mock("~/server/db", () => ({ db: dbMock }));

beforeEach(() => {
    afterMock.mockClear();
    dbMock.delete.mockClear();
    deleteWhereMock.mockClear();
    dbMock.select.mockClear();
    dbMock.insert.mockClear();
    limitMock.mockReset();
    limitMock.mockResolvedValue([]);
    upsertMock.mockReset();
    upsertMock.mockResolvedValue(undefined);
});

describe("deleteExpiredCacheRows", () => {
    it("deletes only cache rows whose deleteAt is in the past", async () => {
        vi.resetModules();
        const { deleteExpiredCacheRows } = await import("~/server/cache");
        const { cache } = await import("~/server/db/schema");

        await deleteExpiredCacheRows();

        expect(dbMock.delete).toHaveBeenCalledTimes(1);
        expect(dbMock.delete).toHaveBeenCalledWith(cache);
        expect(deleteWhereMock).toHaveBeenCalledTimes(1);

        // The delete is scoped to deleteAt < now, not a full-table clear.
        const condition = deleteWhereMock.mock.calls[0]![0];
        const { sql, params } = new PgDialect().sqlToQuery(condition);
        expect(sql).toBe('"cache"."deleteAt" < $1');
        expect(params).toHaveLength(1);
    });
});

describe("withStaleWhileRevalidate", () => {
    it("schedules the expired-row sweep at most once per hour", async () => {
        vi.resetModules();
        const { withStaleWhileRevalidate } = await import("~/server/cache");

        const fetcher = async (): Promise<string> => "fresh";
        await withStaleWhileRevalidate("key-1", fetcher, {
            staleAfter: 60_000,
            deleteAfter: 120_000,
        });
        await withStaleWhileRevalidate("key-2", fetcher, {
            staleAfter: 60_000,
            deleteAfter: 120_000,
        });

        // Only the first call in the hour schedules the sweep.
        expect(afterMock).toHaveBeenCalledTimes(1);

        // The scheduled callback performs the expired-row delete.
        const sweep = afterMock.mock.calls[0]![0];
        await sweep();
        const { cache } = await import("~/server/db/schema");
        expect(dbMock.delete).toHaveBeenCalledWith(cache);
    });
});

describe("fetchAndCache", () => {
    it("returns the live result even if persistence fails", async () => {
        upsertMock.mockRejectedValueOnce(new Error("database unavailable"));
        limitMock.mockResolvedValueOnce([
            {
                value: { items: [{ number: 1 }], totalCount: 1 },
                staleAt: new Date(Date.now() + 60_000),
                deleteAt: new Date(Date.now() + 86_400_000),
            },
        ]);
        const fresh = { items: [], totalCount: 0 };
        const fetcher = vi.fn(async () => fresh);

        await expect(
            fetchAndCache("search", fetcher, {
                staleAfter: 0,
                deleteAfter: 86_400_000,
            }),
        ).resolves.toEqual(fresh);
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("propagates provider failures without caching them", async () => {
        const failure = new Error("provider unavailable");

        await expect(
            fetchAndCache(
                "search",
                async () => {
                    throw failure;
                },
                { staleAfter: 0, deleteAfter: 86_400_000 },
            ),
        ).rejects.toBe(failure);
        expect(dbMock.insert).not.toHaveBeenCalled();
    });
});

describe("searchCacheKey", () => {
    const input = {
        provider: "gh",
        owner: "owner",
        repo: "repo",
        query: "is:open",
        page: 1,
        after: "cursor",
        first: 30,
        sort: "created",
        order: "desc",
    };

    it("isolates identities, resources, and every search dimension", () => {
        const original = searchCacheKey("pulls", "user", input);
        const alternatives = [
            searchCacheKey("pulls", undefined, input),
            searchCacheKey("pulls", "anonymous", input),
            searchCacheKey("pulls", "other-user", input),
            searchCacheKey("issues", "user", input),
            ...Object.entries(input).map(([field, value]) =>
                searchCacheKey("pulls", "user", {
                    ...input,
                    [field]:
                        typeof value === "number"
                            ? value + 1
                            : `${value}:other`,
                }),
            ),
        ];

        expect(new Set([original, ...alternatives]).size).toBe(
            alternatives.length + 1,
        );
    });

    it("canonicalizes property order and omitted optional fields", () => {
        const reversed = Object.fromEntries(Object.entries(input).reverse());

        expect(
            searchCacheKey("pulls", "user", {
                ...reversed,
                optional: undefined,
            }),
        ).toBe(searchCacheKey("pulls", "user", input));
    });
});
