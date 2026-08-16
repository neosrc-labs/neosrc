// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installLocalStorage } from "~/__tests__/helpers/local-storage";
import {
    getDiffViewKey,
    readDiffViewPreference,
    writeDiffViewPreference,
} from "~/utils/diff-view";

describe("diff view preference storage", () => {
    let storage: Storage;

    beforeEach(() => {
        storage = installLocalStorage();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        storage.clear();
    });

    it("keys preferences per repo", () => {
        expect(getDiffViewKey("vercel", "next.js")).toBe(
            "diff-view:vercel:next.js",
        );
        expect(getDiffViewKey("facebook", "react")).toBe(
            "diff-view:facebook:react",
        );
    });

    it("defaults to unified when nothing is stored", () => {
        expect(readDiffViewPreference("owner", "repo")).toBe("unified");
    });

    it("round-trips a stored split preference", () => {
        writeDiffViewPreference("owner", "repo", "split");
        expect(readDiffViewPreference("owner", "repo")).toBe("split");
        writeDiffViewPreference("owner", "repo", "unified");
        expect(readDiffViewPreference("owner", "repo")).toBe("unified");
    });

    it("does not leak preferences across repos", () => {
        writeDiffViewPreference("owner", "repo", "split");
        expect(readDiffViewPreference("other", "repo")).toBe("unified");
    });

    it("falls back to unified for garbage values", () => {
        storage.setItem("diff-view:owner:repo", "banana");
        expect(readDiffViewPreference("owner", "repo")).toBe("unified");
    });

    it("returns unified when localStorage is unavailable", () => {
        vi.spyOn(storage, "getItem").mockImplementation(() => {
            throw new Error("denied");
        });
        expect(readDiffViewPreference("owner", "repo")).toBe("unified");
    });

    it("does not throw when writing is denied", () => {
        vi.spyOn(storage, "setItem").mockImplementation(() => {
            throw new Error("quota");
        });
        expect(() =>
            writeDiffViewPreference("owner", "repo", "split"),
        ).not.toThrow();
    });
});
