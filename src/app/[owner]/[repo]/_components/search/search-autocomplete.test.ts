import { describe, expect, it } from "vitest";
import { detectQualifier, replaceQualifierValue } from "./search-autocomplete";

// Mirrors the issue search qualifiers (see issue-list-config.ts / the
// per-page `qualifiers` config passed to useSearchList).
const QUALIFIERS = ["author", "label", "assignee", "sort", "is"];

describe("detectQualifier", () => {
    it("finds the qualifier under the cursor", () => {
        expect(detectQualifier("is:open author:jo", 17, QUALIFIERS)).toEqual({
            key: "author",
            value: "jo",
            start: 8,
            end: 17,
        });
    });

    it("returns null when the list of supported qualifiers is empty", () => {
        // Regression: an empty list used to produce a pattern that matched an
        // empty key at the cursor, corrupting the query on replacement.
        expect(detectQualifier("author:jo", 9, [])).toBeNull();
    });

    it("returns null for a qualifier the search does not support", () => {
        expect(detectQualifier("milestone:v1", 12, QUALIFIERS)).toBeNull();
    });

    it("returns null when the cursor is not inside a qualifier", () => {
        expect(detectQualifier("bug report", 10, QUALIFIERS)).toBeNull();
    });
});

describe("replaceQualifierValue", () => {
    it("replaces the value of the qualifier under the cursor", () => {
        expect(
            replaceQualifierValue(
                "author:jo",
                9,
                "author",
                "octocat",
                QUALIFIERS,
            ),
        ).toBe("author:octocat ");
    });

    it("never inserts a space between the key and its value", () => {
        const result = replaceQualifierValue(
            "author:jo",
            9,
            "author",
            "octocat",
            QUALIFIERS,
        );
        expect(result).toBe("author:octocat ");
        expect(result).not.toContain("author :octocat");
        expect(result).not.toContain("author:jo");
    });

    it("keeps the surrounding query when replacing a qualifier mid-query", () => {
        expect(
            replaceQualifierValue(
                "is:open author:jo",
                17,
                "author",
                "octocat",
                QUALIFIERS,
            ),
        ).toBe("is:open author:octocat ");
    });

    it("wraps values containing spaces in quotes", () => {
        expect(
            replaceQualifierValue(
                "author:jo",
                9,
                "author",
                "John Doe",
                QUALIFIERS,
            ),
        ).toBe('author:"John Doe" ');
    });

    it("does not double-quote a value pre-wrapped by handleSelect", () => {
        // handleSelect pre-wraps labels containing spaces before onSelect
        // fires, so the value arrives as `"good first issue"`. It must not be
        // wrapped a second time into `label:""good first issue""`.
        expect(
            replaceQualifierValue(
                "label:good",
                10,
                "label",
                '"good first issue"',
                QUALIFIERS,
            ),
        ).toBe('label:"good first issue" ');
    });

    it("does not double the space when replacing a qualifier mid-query", () => {
        expect(
            replaceQualifierValue(
                "author:jo report",
                9,
                "author",
                "octocat",
                QUALIFIERS,
            ),
        ).toBe("author:octocat report");
    });

    it("inserts a new qualifier when the cursor is on plain text at the end", () => {
        expect(
            replaceQualifierValue("bug", 3, "author", "octocat", QUALIFIERS),
        ).toBe("bug author:octocat ");
    });

    it("inserts a new qualifier at a word boundary inside plain text", () => {
        expect(
            replaceQualifierValue(
                "bug report",
                4,
                "author",
                "octocat",
                QUALIFIERS,
            ),
        ).toBe("bug author:octocat report");
    });

    it("leaves the query unchanged when the cursor is mid-word", () => {
        expect(
            replaceQualifierValue("bug", 1, "author", "octocat", QUALIFIERS),
        ).toBe("bug");
    });

    it("leaves the query unchanged when the cursor sits right after an unsupported qualifier", () => {
        expect(
            replaceQualifierValue(
                "milestone:v1",
                12,
                "author",
                "octocat",
                QUALIFIERS,
            ),
        ).toBe("milestone:v1");
    });
});
