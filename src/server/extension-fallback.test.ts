import { beforeEach, describe, expect, it, vi } from "vitest";
import { externalFallbackTarget } from "./extension-fallback";

const state = vi.hoisted(() => ({
    headers: {} as Record<string, string>,
}));

vi.mock("next/headers", () => ({
    headers: async () => ({
        get: (name: string) => state.headers[name] ?? null,
    }),
}));

const EXTENSION_HEADER = "x-neosrc-extension";

function requestFrom(pathname: string, fromExtension = true) {
    state.headers = { "x-pathname": pathname };
    if (fromExtension) state.headers[EXTENSION_HEADER] = "0.5.0";
}

beforeEach(() => {
    state.headers = {};
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

        requestFrom("/gh/acme/widget/issues/7");
        expect(await externalFallbackTarget()).toBe(
            "https://github.com/acme/widget/issues/7?neosrc_exit=1",
        );
    });

    it("leaves direct visits and unmapped pages on Neosrc", async () => {
        requestFrom("/gh/acme/widget", false);
        expect(await externalFallbackTarget()).toBeNull();

        requestFrom("/profile");
        expect(await externalFallbackTarget()).toBeNull();
    });
});
