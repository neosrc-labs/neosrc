import { afterEach, describe, expect, it, vi } from "vitest";

// Stub the db module so importing the Codeberg client does not require env.
vi.mock("~/server/db", () => ({ db: {} }));

import {
    createIssueComment,
    listIssueCommentReactions,
    listIssueReactions,
    listIssues,
    listIssueTimeline,
    updateIssue,
} from "~/server/codeberg";

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
    const mock = vi.fn(async (_url: string) => ({
        ok: true,
        json: async () => items,
        headers: { get: () => null },
    }));
    vi.stubGlobal("fetch", mock);
    return mock;
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

describe("listIssues keyword query", () => {
    it("sends the translated terms as q", async () => {
        const mock = stubFetch([issue({ number: 1 })]);

        await listIssues("tok", "own", "repo", { query: "+foo +bar" });

        const url = new URL(String(mock.mock.calls[0]?.[0]));
        expect(url.searchParams.get("q")).toBe("+foo +bar");
    });

    it("omits q when there are no terms", async () => {
        const mock = stubFetch([issue({ number: 1 })]);

        await listIssues("tok", "own", "repo", {});

        const url = new URL(String(mock.mock.calls[0]?.[0]));
        expect(url.searchParams.has("q")).toBe(false);
    });
});

describe("issue write primitives", () => {
    function stubWrite(payload: unknown = {}) {
        const mock = vi.fn(async (_url: string, _init?: RequestInit) => ({
            ok: true,
            status: 200,
            json: async () => payload,
            headers: { get: () => null },
        }));
        vi.stubGlobal("fetch", mock);
        return mock;
    }

    it("updateIssue PATCHes the issue with the given fields", async () => {
        const mock = stubWrite({
            number: 7,
            title: "t",
            body: "",
            state: "closed",
        });

        await updateIssue("tok", "o", "r", 7, { state: "closed" });

        const [url, init] = mock.mock.calls[0] as [string, RequestInit];
        expect(String(url)).toBe(
            "https://codeberg.org/api/v1/repos/o/r/issues/7",
        );
        expect(init.method).toBe("PATCH");
        expect(JSON.parse(String(init.body))).toEqual({ state: "closed" });
    });

    it("createIssueComment POSTs the body", async () => {
        const mock = stubWrite({ id: 1, body: "hi" });

        await createIssueComment("tok", "o", "r", 7, "hi");

        const [url, init] = mock.mock.calls[0] as [string, RequestInit];
        expect(String(url)).toBe(
            "https://codeberg.org/api/v1/repos/o/r/issues/7/comments",
        );
        expect(init.method).toBe("POST");
        expect(JSON.parse(String(init.body))).toEqual({ body: "hi" });
    });

    it("throws when a write is rejected", async () => {
        const mock = vi.fn(async () => ({
            ok: false,
            status: 403,
            json: async () => ({}),
            headers: { get: () => null },
        }));
        vi.stubGlobal("fetch", mock);

        await expect(
            updateIssue("tok", "o", "r", 7, { state: "closed" }),
        ).rejects.toThrow("Failed to update issue 7 in o/r: 403");
    });
});

describe("listIssueTimeline pagination", () => {
    it("clamps limit to the instance cap and treats a full page as more", async () => {
        const items = Array.from({ length: 50 }, (_, i) => ({
            id: i + 1,
            type: "comment",
            body: "",
            created_at: "",
            user: null,
            label: null,
            milestone: null,
            assignee: null,
        }));
        const mock = vi.fn(async (_url: string) => ({
            ok: true,
            json: async () => items,
            headers: { get: () => null },
        }));
        vi.stubGlobal("fetch", mock);

        const result = await listIssueTimeline("tok", "o", "r", 7, 2, 100);

        const url = new URL(String(mock.mock.calls[0]?.[0]));
        expect(url.searchParams.get("page")).toBe("2");
        expect(url.searchParams.get("limit")).toBe("50");
        expect(result.items).toHaveLength(50);
        expect(result.hasNextPage).toBe(true);
    });

    it("reports no next page for a short page", async () => {
        const mock = vi.fn(async (_url: string) => ({
            ok: true,
            json: async () => [],
            headers: { get: () => null },
        }));
        vi.stubGlobal("fetch", mock);

        const result = await listIssueTimeline("tok", "o", "r", 8, 1, 50);

        expect(result.hasNextPage).toBe(false);
    });
});

describe("null list payloads", () => {
    function stubJsonNull() {
        const mock = vi.fn(async (_url: string) => ({
            ok: true,
            json: async () => null,
            headers: { get: () => null },
        }));
        vi.stubGlobal("fetch", mock);
        return mock;
    }

    it("normalizes a JSON null reaction list to an empty array", async () => {
        stubJsonNull();

        await expect(listIssueReactions("tok", "o", "r", 21)).resolves.toEqual(
            [],
        );
        await expect(
            listIssueCommentReactions("tok", "o", "r", 22),
        ).resolves.toEqual([]);
    });

    it("normalizes a JSON null timeline page to an empty page", async () => {
        stubJsonNull();

        const result = await listIssueTimeline("tok", "o", "r", 23, 1, 50);

        expect(result.items).toEqual([]);
        expect(result.hasNextPage).toBe(false);
    });
});

describe("reaction read failures", () => {
    function stubFailure(status: number) {
        const mock = vi.fn(async (_url: string) => ({
            ok: false,
            status,
            json: async () => ({}),
            headers: { get: () => null },
        }));
        vi.stubGlobal("fetch", mock);
    }

    it("rejects instead of reporting an empty issue reaction list", async () => {
        stubFailure(403);

        await expect(listIssueReactions("tok", "o", "r", 31)).rejects.toThrow(
            "Failed to fetch reactions for issue 31 in o/r: 403",
        );
    });

    it("rejects instead of reporting an empty comment reaction list", async () => {
        stubFailure(500);

        await expect(
            listIssueCommentReactions("tok", "o", "r", 32),
        ).rejects.toThrow(
            "Failed to fetch reactions for comment 32 in o/r: 500",
        );
    });

    it("maps a missing issue or comment to NOT_FOUND", async () => {
        stubFailure(404);

        await expect(
            listIssueReactions("tok", "o", "r", 33),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
        await expect(
            listIssueCommentReactions("tok", "o", "r", 34),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
});
