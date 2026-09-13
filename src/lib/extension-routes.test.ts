import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    EXTENSION_ROUTE_RULES,
    EXTENSION_ROUTE_TABLE_PATH,
    externalUrlForNeosrcPath,
    matchExternalPath,
    serializeExtensionRouteTable,
    templateToRegex,
} from "./extension-routes";

describe("matchExternalPath", () => {
    it("matches the pages Neosrc serves", () => {
        expect(matchExternalPath("github.com", "/acme/widget")?.rule.id).toBe(
            "gh-repo",
        );
        expect(
            matchExternalPath("github.com", "/acme/widget/pulls")?.rule.id,
        ).toBe("gh-pulls");
        expect(
            matchExternalPath("github.com", "/acme/widget/pull/12")?.rule.id,
        ).toBe("gh-pull");
        expect(
            matchExternalPath("github.com", "/acme/widget/pull/12/files")?.rule
                .id,
        ).toBe("gh-pull-files");
        expect(
            matchExternalPath(
                "github.com",
                "/acme/widget/pull/12/commits/0aae42ee043158f0a7a497fe621e012693fd4ee6",
            )?.rule.id,
        ).toBe("gh-pull-commit");
        expect(
            matchExternalPath("github.com", "/acme/widget/issues")?.rule.id,
        ).toBe("gh-issues");
        expect(
            matchExternalPath("github.com", "/acme/widget/issues/7")?.rule.id,
        ).toBe("gh-issue");
        expect(
            matchExternalPath("github.com", "/acme/widget/commits/main")?.rule
                .id,
        ).toBe("gh-commits");
    });

    it("keeps pages Neosrc cannot render on GitHub", () => {
        const unsupported = [
            "/acme",
            "/acme/widget/tree/main/packages",
            "/acme/widget/blob/main/README.md",
            "/acme/widget/pull/12/commits",
            "/acme/widget/pull/12/checks",
            "/acme/widget/commits",
            "/acme/widget/actions",
            "/acme/widget/releases",
            "/acme/widget/settings/access",
            "/acme/widget/wiki/Home",
        ];
        for (const pathname of unsupported) {
            expect(
                matchExternalPath("github.com", pathname),
                pathname,
            ).toBeNull();
        }
    });

    it("ignores reserved GitHub routes that look like owner/repo", () => {
        expect(matchExternalPath("github.com", "/settings/profile")).toBeNull();
        expect(
            matchExternalPath("github.com", "/orgs/acme/settings"),
        ).toBeNull();
        expect(
            matchExternalPath("github.com", "/marketplace/actions/checkout"),
        ).toBeNull();
    });

    it("matches the www host and ignores other hosts", () => {
        expect(
            matchExternalPath("www.github.com", "/acme/widget"),
        ).not.toBeNull();
        expect(matchExternalPath("gist.github.com", "/acme/widget")).toBeNull();
        expect(
            matchExternalPath("github.com.evil.test", "/acme/widget"),
        ).toBeNull();
    });

    it("matches captured values the Neosrc URL is built from", () => {
        const match = matchExternalPath(
            "github.com",
            "/acme/widget/pull/12/files",
        );
        expect(match?.rule.id).toBe("gh-pull-files");
        expect(match?.groups).toEqual(["acme", "widget", "12"]);
    });

    it("matches a percent-encoded branch name as one segment", () => {
        expect(
            matchExternalPath(
                "github.com",
                "/acme/widget/commits/feature%2Fnested",
            )?.groups,
        ).toEqual(["acme", "widget", "feature%2Fnested"]);
    });
});

describe("externalUrlForNeosrcPath", () => {
    it("maps a Neosrc page back to the host URL it stands for", () => {
        expect(externalUrlForNeosrcPath("/gh/acme/widget")).toBe(
            "https://github.com/acme/widget",
        );
        expect(externalUrlForNeosrcPath("/gh/acme/widget/pull/12")).toBe(
            "https://github.com/acme/widget/pull/12",
        );
        expect(
            externalUrlForNeosrcPath("/gh/acme/widget/pull/12/changes"),
        ).toBe("https://github.com/acme/widget/pull/12/files");
        expect(
            externalUrlForNeosrcPath(
                "/gh/acme/widget/pull/12/changes/0aae42ee",
            ),
        ).toBe("https://github.com/acme/widget/pull/12/commits/0aae42ee");
        expect(externalUrlForNeosrcPath("/gh/acme/widget/issues/7")).toBe(
            "https://github.com/acme/widget/issues/7",
        );
        expect(externalUrlForNeosrcPath("/gh/acme/widget/commits/main")).toBe(
            "https://github.com/acme/widget/commits/main",
        );
    });

    it("returns null for pages with no host equivalent", () => {
        expect(externalUrlForNeosrcPath("/")).toBeNull();
        expect(externalUrlForNeosrcPath("/profile")).toBeNull();
        expect(externalUrlForNeosrcPath("/cb/acme/widget")).toBeNull();
        expect(
            externalUrlForNeosrcPath("/gh/acme/widget/blob/main/a.ts"),
        ).toBeNull();
    });
});

describe("route table", () => {
    it("only references capture groups that the pattern defines", () => {
        for (const rule of EXTENSION_ROUTE_RULES) {
            const groupCount = [...rule.pattern.matchAll(/\((?!\?)/g)].length;
            expect(groupCount, rule.id).toBeGreaterThan(0);
            for (const template of [rule.to, rule.external]) {
                for (const [, index] of template.matchAll(/\$(\d)/g)) {
                    expect(
                        Number(index),
                        `${rule.id} ${template}`,
                    ).toBeLessThanOrEqual(groupCount);
                }
            }
        }
    });

    it("keeps patterns within declarativeNetRequest regex syntax", () => {
        for (const rule of EXTENSION_ROUTE_RULES) {
            expect(rule.pattern.startsWith("^"), rule.id).toBe(true);
            expect(rule.pattern.endsWith("$"), rule.id).toBe(true);
            // RE2 has no lookarounds and no backreferences.
            expect(rule.pattern, rule.id).not.toMatch(/\(\?[=!<]|\\\d/);
            // A wide bounded repeat compiles past the 2KB rule limit, and one
            // rejected rule takes the whole rule set down with it.
            expect(rule.pattern, rule.id).not.toMatch(/\{\d+,\d+\}/);
        }
    });

    it("round-trips every Neosrc template through its match regex", () => {
        for (const rule of EXTENSION_ROUTE_RULES) {
            const concrete = rule.to.replace(/\$\d/g, "value");
            const groups = [...rule.to.matchAll(/\$(\d)/g)].map(() => "value");
            expect(templateToRegex(rule.to).exec(concrete)?.slice(1)).toEqual(
                groups.length > 0 ? groups : [],
            );
        }
    });

    it("stays in sync with the table baked into the extension", () => {
        const generated = readFileSync("extension/routes.generated.js", "utf8");
        const json = generated.slice(
            generated.indexOf("=") + 1,
            generated.lastIndexOf(";"),
        );
        const bundle = JSON.parse(json) as {
            path: string;
            table: unknown;
        };
        expect(bundle.table).toEqual(
            JSON.parse(serializeExtensionRouteTable()),
        );
        expect(bundle.path).toBe(EXTENSION_ROUTE_TABLE_PATH);
    });
});
