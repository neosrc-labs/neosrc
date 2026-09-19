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

    it("parses marker-free tree, blob, and blame paths", () => {
        expect(
            parseRepoBrowsePath(`${base}/tree/master/doc/book`, base, null),
        ).toEqual({
            view: "tree",
            reference: { kind: null, value: "master" },
            path: "doc/book",
        });
        expect(
            parseRepoBrowsePath(`${base}/blob/master/a/b.md`, base, null),
        ).toEqual({
            view: "blob",
            reference: { kind: null, value: "master" },
            path: "a/b.md",
        });
        expect(
            parseRepoBrowsePath(`${base}/blame/master/a/b.md`, base, null),
        ).toEqual({
            view: "blame",
            reference: { kind: null, value: "master" },
            path: "a/b.md",
        });
    });

    it("preserves explicit branch, tag, and commit kinds", () => {
        for (const kind of ["branch", "tag", "commit"] as const) {
            expect(
                parseRepoBrowsePath(`${base}/tree/release/doc`, base, kind),
            ).toEqual({
                view: "tree",
                reference: { kind, value: "release" },
                path: "doc",
            });
        }
    });

    it("parses the reference root with an empty path", () => {
        expect(parseRepoBrowsePath(`${base}/tree/master`, base, null)).toEqual({
            view: "tree",
            reference: { kind: null, value: "master" },
            path: "",
        });
    });

    it("decodes encoded reference and path segments", () => {
        expect(
            parseRepoBrowsePath(
                `${base}/tree/renovate%2Fgix-0.x/my%20dir/a%20b.md`,
                base,
                "branch",
            ),
        ).toEqual({
            view: "tree",
            reference: { kind: "branch", value: "renovate/gix-0.x" },
            path: "my dir/a b.md",
        });
    });

    it("keeps a malformed path segment raw", () => {
        expect(
            parseRepoBrowsePath(`${base}/tree/master/a%zz`, base, null),
        ).toEqual({
            view: "tree",
            reference: { kind: null, value: "master" },
            path: "a%zz",
        });
    });

    it("ignores a trailing slash", () => {
        expect(
            parseRepoBrowsePath(`${base}/tree/master/doc/`, base, null),
        ).toEqual({
            view: "tree",
            reference: { kind: null, value: "master" },
            path: "doc",
        });
    });

    it("rejects invalid markers and non-browse paths", () => {
        expect(
            parseRepoBrowsePath(`${base}/tree/master`, base, "release"),
        ).toBeNull();
        expect(parseRepoBrowsePath(base, base, null)).toBeNull();
        expect(parseRepoBrowsePath(`${base}/pulls`, base, null)).toBeNull();
        expect(
            parseRepoBrowsePath(`${base}/pull/12/changes`, base, null),
        ).toBeNull();
        expect(
            parseRepoBrowsePath(`${base}/commits/master`, base, null),
        ).toBeNull();
        expect(parseRepoBrowsePath(`${base}/tree`, base, null)).toBeNull();
        expect(parseRepoBrowsePath(`${base}/tree/`, base, null)).toBeNull();
        expect(
            parseRepoBrowsePath("/cb/o/r/tree/master", base, null),
        ).toBeNull();
    });
});
