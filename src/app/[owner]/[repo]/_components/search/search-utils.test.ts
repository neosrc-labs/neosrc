import { describe, expect, it } from "vitest";
import {
    formatQuery,
    matchQualifierPrefix,
    parseQuery,
    toggleQualifier,
} from "./search-utils";

describe("matchQualifierPrefix", () => {
    const QUALIFIERS = [
        "author",
        "label",
        "assignee",
        "sort",
        "review",
        "status",
        "is",
    ];

    it("matches a unique qualifier prefix at the end of the query", () => {
        expect(matchQualifierPrefix("lab", 3, QUALIFIERS)).toEqual({
            start: 0,
            end: 3,
            value: "label",
        });
    });

    it("matches a word that follows a completed qualifier", () => {
        expect(matchQualifierPrefix("author:foo lab", 14, QUALIFIERS)).toEqual({
            start: 11,
            end: 14,
            value: "label",
        });
    });

    it("matches case-insensitively", () => {
        expect(matchQualifierPrefix("Lab", 3, QUALIFIERS)).toEqual({
            start: 0,
            end: 3,
            value: "label",
        });
    });

    it("ignores a word in a qualifier value", () => {
        expect(matchQualifierPrefix("label:bu", 8, QUALIFIERS)).toBeNull();
    });

    it("ignores a word inside a quoted value", () => {
        expect(matchQualifierPrefix('label:"go', 9, QUALIFIERS)).toBeNull();
    });

    it("ignores an ambiguous prefix", () => {
        expect(matchQualifierPrefix("s", 1, QUALIFIERS)).toBeNull();
    });

    it("ignores a complete qualifier", () => {
        expect(matchQualifierPrefix("label", 5, QUALIFIERS)).toBeNull();
    });

    it("ignores a word the cursor is not at the end of", () => {
        expect(matchQualifierPrefix("lab", 1, QUALIFIERS)).toBeNull();
    });

    it("ignores an empty word", () => {
        expect(matchQualifierPrefix("author:foo ", 12, QUALIFIERS)).toBeNull();
    });
});

describe("toggleQualifier", () => {
    it("removes the qualifier when the exact pair is present", () => {
        expect(toggleQualifier("is:open label:bug", "label", "bug")).toBe(
            "is:open",
        );
    });

    it("replaces a different value of the same key by default", () => {
        expect(toggleQualifier("author:alice", "author", "bob")).toBe(
            "author:bob",
        );
    });

    it("keeps other values of the same key in add mode", () => {
        expect(toggleQualifier("label:bug", "label", "docs", "add")).toBe(
            "label:bug label:docs",
        );
    });

    it("round-trips through parseQuery/formatQuery", () => {
        const query = 'is:open author:alice "quoted text"';
        const parsed = parseQuery(query);
        expect(formatQuery(parsed)).toBe(query);
    });
});
