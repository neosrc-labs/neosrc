import { describe, expect, it } from "vitest";
import { formatQuery, parseQuery, toggleQualifier } from "./search-utils";

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
