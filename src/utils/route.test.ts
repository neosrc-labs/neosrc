import { describe, expect, it } from "vitest";
import { isChangesPage, parseRepoBrowsePath } from "./route";

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

describe("parseRepoBrowsePath", () => {
    const base = "/gh/o/r";

    it("parses a tree path", () => {
        expect(
            parseRepoBrowsePath(`${base}/tree/master/doc/book`, base),
        ).toEqual({ view: "tree", ref: "master", path: "doc/book" });
    });

    it("parses a blob path", () => {
        expect(parseRepoBrowsePath(`${base}/blob/master/a/b.md`, base)).toEqual(
            {
                view: "blob",
                ref: "master",
                path: "a/b.md",
            },
        );
    });

    it("parses the branch root with an empty path", () => {
        expect(parseRepoBrowsePath(`${base}/tree/master`, base)).toEqual({
            view: "tree",
            ref: "master",
            path: "",
        });
    });

    it("decodes an encoded ref", () => {
        expect(
            parseRepoBrowsePath(`${base}/tree/renovate%2Fgix-0.x/doc`, base),
        ).toEqual({
            view: "tree",
            ref: "renovate/gix-0.x",
            path: "doc",
        });
    });

    it("decodes an encoded path segment", () => {
        expect(
            parseRepoBrowsePath(`${base}/blob/master/my%20dir/a%20b.md`, base),
        ).toEqual({
            view: "blob",
            ref: "master",
            path: "my dir/a b.md",
        });
    });

    it("keeps a malformed segment raw", () => {
        expect(parseRepoBrowsePath(`${base}/tree/master/a%zz`, base)).toEqual({
            view: "tree",
            ref: "master",
            path: "a%zz",
        });
    });

    it("ignores a trailing slash", () => {
        expect(parseRepoBrowsePath(`${base}/tree/master/doc/`, base)).toEqual({
            view: "tree",
            ref: "master",
            path: "doc",
        });
    });

    it("returns null for the repo root", () => {
        expect(parseRepoBrowsePath(base, base)).toBeNull();
    });

    it("returns null for other repo routes", () => {
        expect(parseRepoBrowsePath(`${base}/pulls`, base)).toBeNull();
        expect(parseRepoBrowsePath(`${base}/pull/12/changes`, base)).toBeNull();
    });

    it("returns null for a view that is not tree or blob", () => {
        expect(parseRepoBrowsePath(`${base}/commits/master`, base)).toBeNull();
    });

    it("returns null for a missing ref", () => {
        expect(parseRepoBrowsePath(`${base}/tree`, base)).toBeNull();
        expect(parseRepoBrowsePath(`${base}/tree/`, base)).toBeNull();
    });

    it("returns null for another repo's URL", () => {
        expect(parseRepoBrowsePath("/cb/o/r/tree/master", base)).toBeNull();
    });
});
