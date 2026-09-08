import { describe, expect, it } from "vitest";
import {
    type BranchActivity,
    branchFromRef,
    codebergCompareUrl,
    githubCompareUrl,
    RECENT_PUSH_WINDOW_MS,
    rankRecentPushes,
} from "./recent-push";

const NOW = Date.parse("2026-09-09T12:00:00Z");
const minutesAgo = (minutes: number) =>
    new Date(NOW - minutes * 60_000).toISOString();

function push(
    branch: string,
    minutes: number,
    actorLogin = "octocat",
): BranchActivity {
    return { branch, at: minutesAgo(minutes), actorLogin, kind: "push" };
}

function remove(branch: string, minutes: number): BranchActivity {
    return {
        branch,
        at: minutesAgo(minutes),
        actorLogin: "someone",
        kind: "delete",
    };
}

const opts = { viewerLogin: "octocat", defaultBranch: "main", now: NOW };

describe("rankRecentPushes", () => {
    it("returns the viewer's branches newest push first", () => {
        const result = rankRecentPushes(
            [push("older", 30), push("newer", 2)],
            opts,
        );
        expect(result.map((r) => r.branch)).toEqual(["newer", "older"]);
    });

    it("collapses repeated pushes to a branch onto its newest push", () => {
        const result = rankRecentPushes(
            [push("feature", 20), push("feature", 3)],
            opts,
        );
        expect(result).toEqual([
            { branch: "feature", pushedAt: minutesAgo(3) },
        ]);
    });

    it("ignores pushes by other users and to the default branch", () => {
        const result = rankRecentPushes(
            [push("theirs", 5, "hubot"), push("main", 5)],
            opts,
        );
        expect(result).toEqual([]);
    });

    it("drops a branch deleted after the push but keeps one re-pushed after deletion", () => {
        const result = rankRecentPushes(
            [
                push("gone", 10),
                remove("gone", 5),
                push("revived", 10),
                remove("revived", 8),
                push("revived", 4),
            ],
            opts,
        );
        expect(result.map((r) => r.branch)).toEqual(["revived"]);
    });

    it("drops pushes older than the window but keeps the boundary", () => {
        const result = rankRecentPushes(
            [
                {
                    branch: "stale",
                    at: new Date(
                        NOW - RECENT_PUSH_WINDOW_MS - 1000,
                    ).toISOString(),
                    actorLogin: "octocat",
                    kind: "push",
                },
                {
                    branch: "edge",
                    at: new Date(NOW - RECENT_PUSH_WINDOW_MS).toISOString(),
                    actorLogin: "octocat",
                    kind: "push",
                },
            ],
            opts,
        );
        expect(result.map((r) => r.branch)).toEqual(["edge"]);
    });

    it("keeps pushes timestamped ahead of the server clock", () => {
        const result = rankRecentPushes([push("skewed", -5)], opts);
        expect(result.map((r) => r.branch)).toEqual(["skewed"]);
    });

    it("returns nothing for anonymous viewers", () => {
        const result = rankRecentPushes([push("feature", 5)], {
            ...opts,
            viewerLogin: null,
        });
        expect(result).toEqual([]);
    });
});

describe("branchFromRef", () => {
    it("strips the heads prefix and rejects empty refs", () => {
        expect(branchFromRef("refs/heads/feat/login")).toBe("feat/login");
        expect(branchFromRef("feat/login")).toBe("feat/login");
        expect(branchFromRef("")).toBeNull();
        expect(branchFromRef(null)).toBeNull();
    });
});

describe("compare urls", () => {
    it("builds a GitHub compare url with the form pre-expanded", () => {
        expect(githubCompareUrl("acme", "app", "feat/login", "main")).toBe(
            "https://github.com/acme/app/compare/main...feat/login?expand=1",
        );
    });

    it("falls back to the branch-only range without a default branch", () => {
        expect(githubCompareUrl("acme", "app", "feat/login", null)).toBe(
            "https://github.com/acme/app/compare/feat/login?expand=1",
        );
    });

    it("escapes branch characters that are not path separators", () => {
        expect(codebergCompareUrl("acme", "app", "fix/a b", "main")).toBe(
            "https://codeberg.org/acme/app/compare/main...fix/a%20b",
        );
    });
});
