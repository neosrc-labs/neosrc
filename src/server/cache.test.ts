import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub the DB and Next request-scope modules so importing cache.ts doesn't try
// to open a real postgres connection during test load. The db object is a
// no-op query-builder chain that records what deleteExpiredCacheRows issues.
// Modules are imported dynamically (after vi.mock) so the stubs apply before
// evaluation; vi.resetModules() additionally gives each test a fresh module
// instance, which resets the module-level sweep throttle.
const { dbMock, afterMock, deleteWhereMock } = vi.hoisted(() => {
    const deleteWhere = vi.fn();
    return {
        dbMock: {
            delete: vi.fn(() => ({ where: deleteWhere })),
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
                })),
            })),
            insert: vi.fn(() => ({
                values: vi.fn(() => ({
                    onConflictDoUpdate: vi.fn(async () => {}),
                })),
            })),
        },
        afterMock: vi.fn(),
        deleteWhereMock: deleteWhere,
    };
});

vi.mock("next/server", () => ({ after: afterMock }));
vi.mock("~/server/db", () => ({ db: dbMock }));

beforeEach(() => {
    afterMock.mockClear();
    dbMock.delete.mockClear();
    deleteWhereMock.mockClear();
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
