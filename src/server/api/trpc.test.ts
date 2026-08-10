import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

// Stub the modules trpc.ts pulls in at import time so the test does not need
// env vars, a real postgres connection, or an auth session.
vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/env", () => ({
    env: { GITHUB_ANONYMOUS_TOKEN: "shared-anonymous-token" },
}));
vi.mock("~/logging", () => ({
    log: { info: vi.fn(), error: vi.fn() },
}));
vi.mock("~/server/auth", () => ({
    getSession: vi.fn(),
}));

import {
    createCallerFactory,
    createTRPCContext,
    createTRPCRouter,
    protectedMutation,
    protectedProcedure,
} from "~/server/api/trpc";
import { getSession } from "~/server/auth";

const getSessionMock = vi.mocked(getSession);

const router = createTRPCRouter({
    read: protectedProcedure.query(() => "ok"),
    write: protectedMutation.mutation(async ({ ctx }) => ({
        userId: ctx.session?.user?.id,
    })),
});

async function createCaller(session: unknown) {
    getSessionMock.mockResolvedValue(session as never);
    const ctx = await createTRPCContext({ headers: new Headers() });
    return createCallerFactory(router)(ctx);
}

describe("requireSession", () => {
    it("rejects mutations for anonymous visitors even when GITHUB_ANONYMOUS_TOKEN is set", async () => {
        const caller = await createCaller(null);

        await expect(caller.write()).rejects.toBeInstanceOf(TRPCError);
        await expect(caller.write()).rejects.toMatchObject({
            code: "UNAUTHORIZED",
        });
    });

    it("allows mutations for logged-in users", async () => {
        const caller = await createCaller({ user: { id: "user-1" } });

        await expect(caller.write()).resolves.toEqual({ userId: "user-1" });
    });

    it("keeps anonymous reads working when GITHUB_ANONYMOUS_TOKEN is set", async () => {
        const caller = await createCaller(null);

        await expect(caller.read()).resolves.toBe("ok");
    });
});
