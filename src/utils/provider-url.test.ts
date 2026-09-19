import { describe, expect, it } from "vitest";
import {
    blameHref,
    blobHref,
    commitsHref,
    compareUrl,
    historyUrl,
    rawContentReference,
    rawUrl,
    treeHref,
} from "./provider-url";

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

    it("carries explicit reference kinds into commit history links", () => {
        const reference = { kind: "tag", value: "release/1.0" } as const;

        expect(commitsHref("cb", "acme", "app", reference)).toBe(
            "/cb/acme/app/commits/release%2F1.0?refKind=tag",
        );
    });
});

describe("provider content links", () => {
    it("uses Codeberg routes for each explicit reference kind", () => {
        expect(
            rawUrl(
                "cb",
                "acme",
                "app",
                { kind: "branch", value: "main" },
                "docs/a b.md",
            ),
        ).toBe("https://codeberg.org/acme/app/raw/branch/main/docs/a%20b.md");
        expect(
            rawUrl(
                "cb",
                "acme",
                "app",
                { kind: "tag", value: "v1.0.0" },
                "README.md",
            ),
        ).toBe("https://codeberg.org/acme/app/raw/tag/v1.0.0/README.md");
        expect(
            rawUrl(
                "cb",
                "acme",
                "app",
                { kind: "commit", value: "abc123" },
                "README.md",
            ),
        ).toBe("https://codeberg.org/acme/app/raw/commit/abc123/README.md");
    });

    it("uses the reference kind in Codeberg path history links", () => {
        expect(
            historyUrl(
                "cb",
                "acme",
                "app",
                { kind: "tag", value: "v1.0.0" },
                "src/index.ts",
            ),
        ).toBe("https://codeberg.org/acme/app/commits/tag/v1.0.0/src/index.ts");
    });

    it("pins native and commit content while preserving named refs", () => {
        const tag = { kind: "tag", value: "v1.0.0" } as const;

        expect(rawContentReference(tag, "tag-object")).toBe(tag);
        expect(
            rawContentReference(
                { kind: null, value: "main" },
                "resolved-object",
            ),
        ).toEqual({ kind: "commit", value: "resolved-object" });
        expect(
            rawContentReference(
                { kind: "commit", value: "short-sha" },
                "full-object",
            ),
        ).toEqual({ kind: "commit", value: "full-object" });
    });
});
