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
            quoted: false,
            start: 8,
            end: 17,
        });
    });

    it("finds a quoted value the cursor sits inside", () => {
        // Spaces inside the quotes must not stop the match.
        expect(detectQualifier('label:"good first', 17, QUALIFIERS)).toEqual({
            key: "label",
            value: "good first",
            quoted: true,
            start: 0,
            end: 17,
        });
    });

    it("finds an empty quoted value", () => {
        expect(detectQualifier('label:"', 7, QUALIFIERS)).toEqual({
            key: "label",
            value: "",
            quoted: true,
            start: 0,
            end: 7,
        });
    });

    it("returns null once a quoted value is closed", () => {
        expect(detectQualifier('label:"good"', 13, QUALIFIERS)).toBeNull();
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

    it("replaces the whole value when the cursor sits inside it", () => {
        expect(
            replaceQualifierValue(
                "label:A-build-dependencies",
                7,
                "label",
                "bug",
                QUALIFIERS,
            ),
        ).toBe("label:bug ");
    });

    it("keeps the rest of the query when the cursor sits inside a value", () => {
        expect(
            replaceQualifierValue(
                "label:A-build-dependencies is:open",
                7,
                "label",
                "bug",
                QUALIFIERS,
            ),
        ).toBe("label:bug is:open");
    });

    it("consumes a value after the cursor when the cursor is right after the key", () => {
        expect(
            replaceQualifierValue("label:bug", 6, "label", "docs", QUALIFIERS),
        ).toBe("label:docs ");
    });

    it("consumes value characters outside the detection charset", () => {
        expect(
            replaceQualifierValue("label:v1.0", 8, "label", "x", QUALIFIERS),
        ).toBe("label:x ");
    });

    it("replaces the whole quoted value when the cursor is inside it", () => {
        expect(
            replaceQualifierValue(
                'label:"good first issue"',
                17,
                "label",
                '"bug fix"',
                QUALIFIERS,
            ),
        ).toBe('label:"bug fix" ');
    });

    it("keeps the rest of the query when replacing inside a quoted value", () => {
        expect(
            replaceQualifierValue(
                'label:"good first issue" is:open',
                17,
                "label",
                '"bug fix"',
                QUALIFIERS,
            ),
        ).toBe('label:"bug fix" is:open');
    });

    it("consumes an existing quoted value when the cursor is right after the key", () => {
        expect(
            replaceQualifierValue(
                'label:"good first issue"',
                6,
                "label",
                "bug",
                QUALIFIERS,
            ),
        ).toBe("label:bug ");
    });
});
