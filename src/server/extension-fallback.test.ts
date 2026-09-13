import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RepoData } from "~/app/[owner]/[repo]/_components/repo-code-page";
import {
    externalFallbackTarget,
    fallbackToExternal,
} from "./extension-fallback";
import { requireRepoData } from "./repo-route";

const state = vi.hoisted(() => ({
    headers: {} as Record<string, string>,
    redirected: [] as string[],
    notFoundCount: 0,
}));

vi.mock("next/headers", () => ({
    headers: async () => ({
        get: (name: string) => state.headers[name] ?? null,
    }),
}));

vi.mock("next/navigation", () => ({
    redirect: (url: string) => {
        state.redirected.push(url);
        throw new Error("NEXT_REDIRECT");
    },
    notFound: () => {
        state.notFoundCount += 1;
        throw new Error("NEXT_NOT_FOUND");
    },
}));

const EXTENSION_HEADER = "x-neosrc-extension";

function requestFrom(pathname: string, fromExtension = true) {
    state.headers = { "x-pathname": pathname };
    if (fromExtension) state.headers[EXTENSION_HEADER] = "0.5.0";
}

beforeEach(() => {
    state.headers = {};
    state.redirected = [];
    state.notFoundCount = 0;
});

describe("externalFallbackTarget", () => {
    it("maps a Neosrc page back to the host URL the extension came from", async () => {
        requestFrom("/gh/acme/widget");
        expect(await externalFallbackTarget()).toBe(
            "https://github.com/acme/widget?neosrc_exit=1",
        );

        requestFrom("/gh/acme/widget/pull/12/changes");
        expect(await externalFallbackTarget()).toBe(
            "https://github.com/acme/widget/pull/12/files?neosrc_exit=1",
        );
    });

    it("leaves direct visits and unmapped pages on Neosrc", async () => {
        requestFrom("/gh/acme/widget", false);
        expect(await externalFallbackTarget()).toBeNull();

        requestFrom("/profile");
        expect(await externalFallbackTarget()).toBeNull();
    });
});

describe("requireRepoData", () => {
    it("hands an unreadable repository back to the host for the extension", async () => {
        requestFrom("/gh/acme/widget");
        const missing = Promise.reject(new TRPCError({ code: "NOT_FOUND" }));

        await expect(requireRepoData(missing)).rejects.toThrow("NEXT_REDIRECT");
        expect(state.redirected).toEqual([
            "https://github.com/acme/widget?neosrc_exit=1",
        ]);
        expect(state.notFoundCount).toBe(0);
    });

    it("shows the 404 page when the visitor is not coming from the extension", async () => {
        requestFrom("/gh/acme/widget", false);
        const missing = Promise.reject(new TRPCError({ code: "NOT_FOUND" }));

        await expect(requireRepoData(missing)).rejects.toThrow(
            "NEXT_NOT_FOUND",
        );
        expect(state.redirected).toEqual([]);
    });

    it("keeps other failures as errors", async () => {
        requestFrom("/gh/acme/widget");
        const failed = Promise.reject(
            new TRPCError({ code: "INTERNAL_SERVER_ERROR" }),
        );

        await expect(requireRepoData(failed)).rejects.toThrow(TRPCError);
        expect(state.redirected).toEqual([]);
        expect(state.notFoundCount).toBe(0);
    });

    it("resolves repository metadata for readable repositories", async () => {
        requestFrom("/gh/acme/widget");
        const repo = { defaultBranch: "main" } as RepoData;

        await expect(requireRepoData(Promise.resolve(repo))).resolves.toBe(
            repo,
        );
        expect(state.redirected).toEqual([]);
    });
});

describe("fallbackToExternal", () => {
    it("redirects only when the extension explains where the visitor came from", async () => {
        requestFrom("/gh/acme/widget/issues/7");
        await expect(fallbackToExternal()).rejects.toThrow("NEXT_REDIRECT");
        expect(state.redirected).toEqual([
            "https://github.com/acme/widget/issues/7?neosrc_exit=1",
        ]);

        state.redirected = [];
        requestFrom("/gh/acme/widget/issues/7", false);
        await expect(fallbackToExternal()).resolves.toBeUndefined();
        expect(state.redirected).toEqual([]);
    });
});
