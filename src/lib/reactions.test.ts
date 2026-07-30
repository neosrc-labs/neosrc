import { describe, expect, it } from "vitest";
import { toggleReactionInList } from "~/lib/reactions";
import type { GQLReactionNode } from "~/server/github-graphql";

function reaction(overrides: Partial<GQLReactionNode>): GQLReactionNode {
    return {
        databaseId: 100,
        content: "+1",
        createdAt: "2024-01-01T00:00:00.000Z",
        user: { login: "alice" },
        ...overrides,
    };
}

describe("toggleReactionInList", () => {
    it("adds a new reaction when the user has not reacted with the given content", () => {
        const items: GQLReactionNode[] = [];
        const result = toggleReactionInList(items, "alice", "+1");

        expect(result).toHaveLength(1);
        const added = result[0];
        expect(added).toBeDefined();
        expect(added?.user?.login).toBe("alice");
        expect(added?.content).toBe("+1");
        expect(typeof added?.createdAt).toBe("string");
        // New reactions use a negative databaseId sentinel (not yet persisted).
        expect(added?.databaseId).toBeLessThan(0);
    });

    it("assigns a unique negative databaseId based on the current time", () => {
        const before = Date.now();
        const result = toggleReactionInList([], "alice", "+1");
        const after = Date.now();
        const added = result[0];
        expect(added).toBeDefined();
        // databaseId is the negation of the timestamp at the moment of creation.
        expect(added?.databaseId).toBeGreaterThanOrEqual(-after);
        expect(added?.databaseId).toBeLessThanOrEqual(-before);
    });

    it("returns a valid ISO 8601 string for createdAt", () => {
        const result = toggleReactionInList([], "alice", "heart");
        const added = result[0];
        expect(added).toBeDefined();
        expect(() =>
            new Date(added?.createdAt ?? "").toISOString(),
        ).not.toThrow();
        expect(Number.isNaN(Date.parse(added?.createdAt ?? ""))).toBe(false);
    });

    it("removes the existing reaction when the same user+content is toggled", () => {
        const items: GQLReactionNode[] = [
            reaction({
                databaseId: 1,
                content: "+1",
                user: { login: "alice" },
            }),
        ];
        const result = toggleReactionInList(items, "alice", "+1");
        expect(result).toEqual([]);
    });

    it("only removes the matching reaction and leaves others intact", () => {
        const items: GQLReactionNode[] = [
            reaction({
                databaseId: 1,
                content: "+1",
                user: { login: "alice" },
            }),
            reaction({
                databaseId: 2,
                content: "heart",
                user: { login: "alice" },
            }),
            reaction({ databaseId: 3, content: "+1", user: { login: "bob" } }),
        ];
        const result = toggleReactionInList(items, "alice", "+1");
        expect(result).toHaveLength(2);
        const remaining = result.map((r) => r.databaseId);
        expect(remaining).toEqual([2, 3]);
    });

    it("adds a new reaction when only another user has reacted with the same content", () => {
        const items: GQLReactionNode[] = [
            reaction({ databaseId: 3, content: "+1", user: { login: "bob" } }),
        ];
        const result = toggleReactionInList(items, "alice", "+1");
        expect(result).toHaveLength(2);
        const aliceReaction = result.find((r) => r.user?.login === "alice");
        expect(aliceReaction).toBeDefined();
        expect(aliceReaction?.content).toBe("+1");
    });

    it("adds a new reaction for the same user with a different content", () => {
        const items: GQLReactionNode[] = [
            reaction({
                databaseId: 1,
                content: "+1",
                user: { login: "alice" },
            }),
        ];
        const result = toggleReactionInList(items, "alice", "heart");
        expect(result).toHaveLength(2);
        const contents = result.map((r) => r.content);
        expect(contents).toEqual(["+1", "heart"]);
    });

    it("does not match a reaction with a null user", () => {
        const items: GQLReactionNode[] = [
            reaction({ databaseId: 7, content: "+1", user: null }),
        ];
        const result = toggleReactionInList(items, "alice", "+1");
        expect(result).toHaveLength(2);
        const original = result.find((r) => r.databaseId === 7);
        const added = result.find((r) => r.user?.login === "alice");
        expect(original).toBeDefined();
        expect(original?.user).toBeNull();
        expect(added).toBeDefined();
        expect(added?.content).toBe("+1");
    });

    it("does not mutate the input items array", () => {
        const items: GQLReactionNode[] = [
            reaction({
                databaseId: 1,
                content: "+1",
                user: { login: "alice" },
            }),
        ];
        const snapshot = items.map((r) => r.databaseId);
        toggleReactionInList(items, "alice", "+1");
        expect(items.map((r) => r.databaseId)).toEqual(snapshot);
    });
});
