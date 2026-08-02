import { describe, expect, it } from "vitest";
import { isChangesPage } from "./route";

describe("isChangesPage", () => {
    it("returns true for /pull/123/changes", () => {
        expect(isChangesPage("/pull/123/changes")).toBe(true);
    });

    it("returns true for /pull/123/changes/abc", () => {
        expect(isChangesPage("/pull/123/changes/abc")).toBe(true);
    });

    it("returns false for /pull/123", () => {
        expect(isChangesPage("/pull/123")).toBe(false);
    });

    it("returns false for /pullrequest/", () => {
        expect(isChangesPage("/pullrequest/")).toBe(false);
    });

    it("returns false for empty string", () => {
        expect(isChangesPage("")).toBe(false);
    });

    it("returns false for null/undefined pathname", () => {
        expect(isChangesPage(null as unknown as string)).toBeFalsy();
    });

    it("returns true for nested files path", () => {
        expect(isChangesPage("/pull/123/changes/src/utils/")).toBe(true);
    });

    it("returns false for pulls listing", () => {
        expect(isChangesPage("/pulls")).toBe(false);
    });
});
