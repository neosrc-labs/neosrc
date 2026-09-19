import { describe, expect, it } from "vitest";
import { blameHref, blobHref, compareUrl, treeHref } from "./provider-url";

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

describe("repository browse links", () => {
    it("keeps marker-free links unchanged", () => {
        const reference = { kind: null, value: "release/1.x" } as const;

        expect(treeHref("gh", "acme", "app", reference, "src/lib")).toBe(
            "/gh/acme/app/tree/release%2F1.x/src/lib",
        );
        expect(blobHref("gh", "acme", "app", reference, "src/a b.ts")).toBe(
            "/gh/acme/app/blob/release%2F1.x/src/a%20b.ts",
        );
    });

    it("carries explicit reference kinds across tree, blob, and blame links", () => {
        const reference = { kind: "commit", value: "abc123" } as const;

        expect(treeHref("gh", "acme", "app", reference, "src")).toBe(
            "/gh/acme/app/tree/abc123/src?refKind=commit",
        );
        expect(blobHref("gh", "acme", "app", reference, "src/a.ts")).toBe(
            "/gh/acme/app/blob/abc123/src/a.ts?refKind=commit",
        );
        expect(blameHref("gh", "acme", "app", reference, "src/a.ts")).toBe(
            "/gh/acme/app/blame/abc123/src/a.ts?refKind=commit",
        );
    });
});
