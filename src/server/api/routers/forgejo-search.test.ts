import { describe, expect, it } from "vitest";
import {
    forgejoStateCounts,
    parseForgejoQuery,
} from "~/server/api/routers/forgejo-search";

describe("parseForgejoQuery", () => {
    it("defaults to open when no state qualifier is present", () => {
        expect(parseForgejoQuery("", { allowMerged: false }).activeState).toBe(
            "open",
        );
        expect(
            parseForgejoQuery("author:alice label:bug", { allowMerged: false })
                .activeState,
        ).toBe("open");
    });

    it("parses a leading state qualifier", () => {
        expect(
            parseForgejoQuery("is:closed author:alice", { allowMerged: false })
                .activeState,
        ).toBe("closed");
    });

    it("parses a state qualifier after an author qualifier", () => {
        const result = parseForgejoQuery("author:alice is:closed", {
            allowMerged: false,
        });
        expect(result.activeState).toBe("closed");
        expect(result.author).toBe("alice");
    });

    it("parses a merged state qualifier after a label qualifier for pulls", () => {
        const result = parseForgejoQuery('label:"tech debt" is:merged', {
            allowMerged: true,
        });
        expect(result.activeState).toBe("merged");
        expect(result.labels).toEqual(["tech debt"]);
    });

    it("does not match state tokens inside larger tokens", () => {
        // "mis:closed" contains "is:closed" but is not a valid qualifier.
        expect(
            parseForgejoQuery("mis:closed", { allowMerged: false }).activeState,
        ).toBe("open");
    });

    it("still extracts author and labels alongside the state", () => {
        const result = parseForgejoQuery("is:open author:bob label:x label:y", {
            allowMerged: false,
        });
        expect(result).toEqual({
            activeState: "open",
            author: "bob",
            labels: ["x", "y"],
        });
    });
});

// Test seam: captures the params each count request passes to the list fn.
async function captureCountParams(options: {
    author?: string;
    labels?: string[];
}) {
    const captured: Array<Record<string, unknown>> = [];
    const list = async (
        _token: string,
        _owner: string,
        _repo: string,
        params: { state: string; sort: string; limit: number; page: number },
    ) => {
        captured.push(params);
        return { totalCount: 7 };
    };
    const counts = await forgejoStateCounts(
        list,
        "tok",
        "own",
        "repo",
        "newest",
        options,
    );
    return { counts, captured };
}

describe("forgejoStateCounts", () => {
    it("issues one open and one closed count request", async () => {
        const { counts, captured } = await captureCountParams({});
        expect(counts).toEqual({ open: 7, closed: 7 });
        expect(captured.map((p) => p.state)).toEqual(["open", "closed"]);
    });

    it("passes author and label filters into both count requests", async () => {
        const { captured } = await captureCountParams({
            author: "alice",
            labels: ["bug"],
        });
        expect(captured).toHaveLength(2);
        for (const params of captured) {
            expect(params.author).toBe("alice");
            expect(params.labels).toEqual(["bug"]);
            expect(params.limit).toBe(1);
            expect(params.page).toBe(1);
        }
    });
});
