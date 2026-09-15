import { describe, expect, it } from "vitest";
import { paginateRows, selectTabRows } from "./tabs";
import type { BranchRow, BranchTab } from "./types";

const NOW = Date.parse("2026-09-09T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function branch(name: string, daysAgo: number): BranchRow {
    return {
        name,
        sha: name,
        updatedAt: new Date(NOW - daysAgo * DAY_MS).toISOString(),
        author: null,
        isProtected: false,
        pullRequestNumber: null,
        checks: [],
    };
}

function select(tab: BranchTab, rows: BranchRow[], query = "") {
    return selectTabRows(rows, {
        tab,
        query,
        defaultBranch: "main",
        now: NOW,
    }).map((row) => row.name);
}

const ROWS = [
    branch("main", 1),
    branch("fresh", 10),
    branch("boundary", 90),
    branch("old", 91),
    branch("ancient", 400),
    branch("TurboPack", 20),
];

describe("selectTabRows", () => {
    it("treats the 90 day boundary as active and hides the default branch", () => {
        expect(select("active", ROWS)).toEqual([
            "fresh",
            "TurboPack",
            "boundary",
        ]);
    });

    it("orders stale branches oldest first", () => {
        expect(select("stale", ROWS)).toEqual(["ancient", "old"]);
    });

    it("keeps the default branch only on the all tab, newest first", () => {
        expect(select("all", ROWS)).toEqual([
            "main",
            "fresh",
            "TurboPack",
            "boundary",
            "old",
            "ancient",
        ]);
    });

    it("matches the query case-insensitively on a substring", () => {
        expect(select("all", ROWS, "turbo")).toEqual(["TurboPack"]);
        expect(select("all", ROWS, "pack")).toEqual(["TurboPack"]);
        expect(select("all", ROWS, "  FRESH ")).toEqual(["fresh"]);
    });

    it("caps the overview preview at five active branches", () => {
        const many = [
            branch("main", 1),
            ...Array.from({ length: 7 }, (_, i) => branch(`b${i}`, 2 + i)),
        ];

        const preview = select("overview", many);

        expect(preview).toHaveLength(5);
        expect(preview[0]).toBe("b0");
        expect(preview).not.toContain("main");
    });

    it("counts a branch without a commit date as stale", () => {
        const undated: BranchRow = { ...branch("undated", 0), updatedAt: "" };

        expect(select("stale", [...ROWS, undated])).toContain("undated");
        expect(select("active", [...ROWS, undated])).not.toContain("undated");
    });
});

describe("paginateRows", () => {
    it("reports no next page on the last full page", () => {
        const rows = [1, 2, 3, 4];

        expect(paginateRows(rows, 2, 2)).toEqual({
            items: [3, 4],
            totalCount: 4,
            hasNextPage: false,
        });
        expect(paginateRows(rows, 1, 2).hasNextPage).toBe(true);
    });

    it("returns an empty page past the end", () => {
        expect(paginateRows([1, 2], 3, 2)).toEqual({
            items: [],
            totalCount: 2,
            hasNextPage: false,
        });
    });
});
