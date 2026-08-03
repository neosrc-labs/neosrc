import { describe, expect, it, vi } from "vitest";
import { buildStackSuggestion, MAX_STACK_SIZE } from "./stack-suggestion";

function pr(number: number, baseRef: string, title = `PR ${number}`) {
    return { number, title, baseRef };
}

describe("buildStackSuggestion", () => {
    it("returns null when the base branch has no open PR", async () => {
        const findBelow = vi.fn(async () => null);
        const suggestion = await buildStackSuggestion(
            pr(10, "feature-a"),
            findBelow,
        );

        expect(suggestion).toBeNull();
        expect(findBelow).toHaveBeenCalledOnce();
        expect(findBelow).toHaveBeenCalledWith("feature-a");
    });

    it("returns a 2-PR chain bottom to top when the base branch has an open PR", async () => {
        const findBelow = vi
            .fn()
            .mockResolvedValueOnce(pr(5, "main"))
            .mockResolvedValue(null);
        const suggestion = await buildStackSuggestion(
            pr(10, "feature-a"),
            findBelow,
        );

        expect(suggestion).toEqual({
            pullRequests: [
                { number: 5, title: "PR 5" },
                { number: 10, title: "PR 10" },
            ],
        });
        expect(findBelow).toHaveBeenCalledTimes(2);
    });

    it("walks a deep chain, ordering bottom to top", async () => {
        // PR 3's head is the branch PR 4 bases on; PR 2's head is what PR 3
        // bases on; and so on down to PR 1 which targets main.
        const below = new Map<
            string,
            { number: number; title: string; baseRef: string }
        >([
            ["branch-3", pr(3, "branch-2")],
            ["branch-2", pr(2, "branch-1")],
            ["branch-1", pr(1, "main")],
        ]);
        const findBelow = vi.fn(
            async (headRef: string) => below.get(headRef) ?? null,
        );

        const suggestion = await buildStackSuggestion(
            pr(4, "branch-3"),
            findBelow,
        );

        expect(suggestion?.pullRequests.map((p) => p.number)).toEqual([
            1, 2, 3, 4,
        ]);
    });

    it("stops at the first missing link in the chain", async () => {
        const findBelow = vi
            .fn()
            .mockResolvedValueOnce(pr(5, "branch-x"))
            .mockResolvedValueOnce(pr(2, "branch-y"))
            .mockResolvedValue(null);

        const suggestion = await buildStackSuggestion(
            pr(10, "feature-a"),
            findBelow,
        );

        expect(suggestion?.pullRequests.map((p) => p.number)).toEqual([
            2, 5, 10,
        ]);
        expect(findBelow).toHaveBeenCalledTimes(3);
    });

    it("caps the chain at MAX_STACK_SIZE pull requests", async () => {
        // Every branch has an open PR below it, so the walk would never end
        // on its own; the cap must stop it.
        const findBelow = vi.fn(async () => pr(999, "branch-999"));
        const suggestion = await buildStackSuggestion(
            pr(1000, "branch-999"),
            findBelow,
        );

        expect(suggestion?.pullRequests).toHaveLength(MAX_STACK_SIZE);
        expect(suggestion?.pullRequests[0]?.number).toBe(999);
        expect(suggestion?.pullRequests.at(-1)?.number).toBe(1000);
        expect(findBelow).toHaveBeenCalledTimes(MAX_STACK_SIZE - 1);
    });
});
