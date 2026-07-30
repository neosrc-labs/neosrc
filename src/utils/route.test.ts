import { describe, expect, it } from "vitest";
import { isFilesPage } from "./route";

describe("isFilesPage", () => {
    it("returns true for /pull/123/files", () => {
        expect(isFilesPage("/pull/123/files")).toBe(true);
    });

    it("returns true for /pull/123/files/abc", () => {
        expect(isFilesPage("/pull/123/files/abc")).toBe(true);
    });

    it("returns false for /pull/123", () => {
        expect(isFilesPage("/pull/123")).toBe(false);
    });

    it("returns false for /pullrequest/", () => {
        expect(isFilesPage("/pullrequest/")).toBe(false);
    });

    it("returns false for empty string", () => {
        expect(isFilesPage("")).toBe(false);
    });

    it("returns false for null/undefined pathname", () => {
        expect(isFilesPage(null as unknown as string)).toBeFalsy();
    });

    it("returns true for nested files path", () => {
        expect(isFilesPage("/pull/123/files/src/utils/")).toBe(true);
    });

    it("returns false for pulls listing", () => {
        expect(isFilesPage("/pulls")).toBe(false);
    });
});
