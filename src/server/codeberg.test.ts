import { afterEach, describe, expect, it, vi } from "vitest";

// Stub the db module so importing the Codeberg client does not require env.
vi.mock("~/server/db", () => ({ db: {} }));

import { listIssues } from "~/server/codeberg";

function issue(overrides: Record<string, unknown> = {}) {
    return {
        id: 1,
        number: 1,
        title: "t",
        state: "open",
        pull_request: null,
        assignees: [],
        labels: [],
        milestone: null,
        user: null,
        ...overrides,
    };
}

function stubFetch(items: unknown[]) {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
            ok: true,
            json: async () => items,
            headers: { get: () => null },
        })),
    );
}

const BOB = { id: 9, login: "bob", avatar_url: "" };
const BUG = { id: 3, name: "bug", color: "f00", description: null };

function numbers(items: Array<{ number: number }>) {
    return items.map((item) => item.number);
}

afterEach(() => vi.unstubAllGlobals());

describe("listIssues presence filter", () => {
    it("keeps only unassigned issues for no:assignee", async () => {
        stubFetch([
            issue({ number: 1, assignees: [] }),
            issue({ number: 2, assignees: [BOB] }),
            issue({ number: 3, assignees: null }),
        ]);

        const result = await listIssues("tok", "own", "repo", {
            presence: { assignee: "no" },
        });

        expect(numbers(result.items)).toEqual([1, 3]);
    });

    it("keeps only assigned issues for has:assignee", async () => {
        stubFetch([
            issue({ number: 1 }),
            issue({ number: 2, assignees: [BOB] }),
        ]);

        const result = await listIssues("tok", "own", "repo", {
            presence: { assignee: "has" },
        });

        expect(numbers(result.items)).toEqual([2]);
    });

    it("filters labels in both directions", async () => {
        stubFetch([
            issue({ number: 1, labels: [] }),
            issue({ number: 2, labels: [BUG] }),
        ]);

        const without = await listIssues("tok", "own", "repo", {
            presence: { label: "no" },
        });
        const withLabel = await listIssues("tok", "own", "repo", {
            presence: { label: "has" },
        });

        expect(numbers(without.items)).toEqual([1]);
        expect(numbers(withLabel.items)).toEqual([2]);
    });

    it("filters milestones in both directions", async () => {
        stubFetch([
            issue({ number: 1, milestone: null }),
            issue({ number: 2, milestone: { id: 4, title: "v1" } }),
        ]);

        const without = await listIssues("tok", "own", "repo", {
            presence: { milestone: "no" },
        });
        const withMilestone = await listIssues("tok", "own", "repo", {
            presence: { milestone: "has" },
        });

        expect(numbers(without.items)).toEqual([1]);
        expect(numbers(withMilestone.items)).toEqual([2]);
    });

    it("combines presence filters", async () => {
        stubFetch([
            issue({ number: 1, assignees: [BOB], labels: [BUG] }),
            issue({ number: 2, assignees: [BOB], labels: [] }),
            issue({ number: 3, labels: [BUG] }),
        ]);

        const result = await listIssues("tok", "own", "repo", {
            presence: { assignee: "has", label: "has" },
        });

        expect(numbers(result.items)).toEqual([1]);
    });

    it("keeps every issue when no presence filter is set", async () => {
        stubFetch([
            issue({ number: 1 }),
            issue({ number: 2, assignees: [BOB] }),
        ]);

        const result = await listIssues("tok", "own", "repo", {});

        expect(numbers(result.items)).toEqual([1, 2]);
    });
});
