import { describe, expect, it } from "vitest";
import { compareUrl } from "./provider-url";

describe("compareUrl", () => {
    it("builds a GitHub compare url with the form pre-expanded", () => {
        expect(compareUrl("gh", "acme", "app", "feat/login", "main")).toBe(
            "https://github.com/acme/app/compare/main...feat/login?expand=1",
        );
    });

    it("falls back to the branch-only range without a default branch", () => {
        expect(compareUrl("gh", "acme", "app", "feat/login", null)).toBe(
            "https://github.com/acme/app/compare/feat/login?expand=1",
        );
    });

    it("escapes branch characters that are not path separators", () => {
        expect(compareUrl("cb", "acme", "app", "fix/a b", "main")).toBe(
            "https://codeberg.org/acme/app/compare/main...fix/a%20b",
        );
    });
});
