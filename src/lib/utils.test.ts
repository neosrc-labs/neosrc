import { describe, expect, it } from "vitest";
import { applyArrayOperations, cn, opId, parseTarget } from "~/lib/utils";

describe("cn", () => {
    it("returns a string for a single class", () => {
        const result = cn("foo");
        expect(typeof result).toBe("string");
        expect(result).toContain("foo");
    });

    it("joins multiple class names with a space", () => {
        const result = cn("foo", "bar", "baz");
        expect(result).toContain("foo");
        expect(result).toContain("bar");
        expect(result).toContain("baz");
    });

    it("ignores falsy values", () => {
        const result = cn("foo", false, null, undefined, 0, "", "bar");
        expect(result).toContain("foo");
        expect(result).toContain("bar");
    });

    it("handles conditional class objects", () => {
        const result = cn("base", { active: true, disabled: false });
        expect(result).toContain("base");
        expect(result).toContain("active");
        expect(result).not.toContain("disabled");
    });

    it("merges conflicting tailwind classes (later wins)", () => {
        const result = cn("px-2", "px-4");
        expect(result).toContain("px-4");
        expect(result).not.toContain("px-2");
    });
});

describe("opId", () => {
    it("returns a finite number", () => {
        const id = opId();
        expect(typeof id).toBe("number");
        expect(Number.isFinite(id)).toBe(true);
    });

    it("returns a non-negative integer below 10_000_000", () => {
        for (let i = 0; i < 100; i++) {
            const id = opId();
            expect(id).toBeGreaterThanOrEqual(0);
            expect(id).toBeLessThan(10_000_000);
            expect(Number.isInteger(id)).toBe(true);
        }
    });

    it("returns different values across calls (statistically)", () => {
        const ids = new Set<number>();
        for (let i = 0; i < 50; i++) {
            ids.add(opId());
        }
        // With 50 samples in a 10M space, collisions are astronomically unlikely.
        expect(ids.size).toBeGreaterThan(45);
    });
});

describe("parseTarget", () => {
    it("splits on the first colon when present", () => {
        const result = parseTarget("github:owner/repo");
        expect(result).toEqual({ provider: "github", name: "owner/repo" });
    });

    it("returns null provider when there is no colon", () => {
        const result = parseTarget("owner/repo");
        expect(result).toEqual({ provider: null, name: "owner/repo" });
    });

    it("returns null provider and empty name for an empty string", () => {
        const result = parseTarget("");
        expect(result).toEqual({ provider: null, name: "" });
    });

    it("preserves the rest of the string when it contains additional colons", () => {
        const result = parseTarget("a:b:c");
        expect(result).toEqual({ provider: "a", name: "b:c" });
    });

    it("returns null provider when the target starts with a colon (no provider)", () => {
        const result = parseTarget(":foo");
        expect(result).toEqual({ provider: null, name: "foo" });
    });

    it("returns null provider and empty name for a lone colon", () => {
        const result = parseTarget(":");
        expect(result).toEqual({ provider: null, name: "" });
    });
});

describe("applyArrayOperations", () => {
    type Item = { id: number; label: string };
    const getValue = (op: {
        id: number;
        op: "add" | "remove";
        label: string;
    }): Item => ({
        id: op.id,
        label: op.label,
    });
    const keyFn = (item: Item) => String(item.id);

    it("returns an empty array for empty items and empty operations", () => {
        const result = applyArrayOperations<
            Item,
            { id: number; op: "add" | "remove"; label: string }
        >([], [], getValue, keyFn);
        expect(result).toEqual([]);
    });

    it("returns the items unchanged for empty operations", () => {
        const items: Item[] = [{ id: 1, label: "a" }];
        const result = applyArrayOperations(items, [], getValue, keyFn);
        expect(result).toEqual([{ id: 1, label: "a" }]);
    });

    it("adds a new item when the key is not present", () => {
        const items: Item[] = [{ id: 1, label: "a" }];
        const ops = [{ id: 2, op: "add" as const, label: "b" }];
        const result = applyArrayOperations(items, ops, getValue, keyFn);
        expect(result).toEqual([
            { id: 1, label: "a" },
            { id: 2, label: "b" },
        ]);
    });

    it("is a no-op for an add op with a duplicate key", () => {
        const items: Item[] = [{ id: 1, label: "a" }];
        const ops = [{ id: 1, op: "add" as const, label: "different" }];
        const result = applyArrayOperations(items, ops, getValue, keyFn);
        expect(result).toEqual([{ id: 1, label: "a" }]);
    });

    it("removes an existing item by key", () => {
        const items: Item[] = [
            { id: 1, label: "a" },
            { id: 2, label: "b" },
        ];
        const ops = [{ id: 1, op: "remove" as const, label: "a" }];
        const result = applyArrayOperations(items, ops, getValue, keyFn);
        expect(result).toEqual([{ id: 2, label: "b" }]);
    });

    it("is a no-op for a remove op with a missing key", () => {
        const items: Item[] = [{ id: 1, label: "a" }];
        const ops = [{ id: 99, op: "remove" as const, label: "x" }];
        const result = applyArrayOperations(items, ops, getValue, keyFn);
        expect(result).toEqual([{ id: 1, label: "a" }]);
    });

    it("applies add then remove of the same key, leaving it absent", () => {
        const items: Item[] = [{ id: 1, label: "a" }];
        const ops = [
            { id: 2, op: "add" as const, label: "b" },
            { id: 2, op: "remove" as const, label: "b" },
        ];
        const result = applyArrayOperations(items, ops, getValue, keyFn);
        expect(result).toEqual([{ id: 1, label: "a" }]);
    });

    it("applies remove then add of the same key, leaving it present", () => {
        const items: Item[] = [{ id: 1, label: "a" }];
        const ops = [
            { id: 1, op: "remove" as const, label: "a" },
            { id: 1, op: "add" as const, label: "a" },
        ];
        const result = applyArrayOperations(items, ops, getValue, keyFn);
        expect(result).toEqual([{ id: 1, label: "a" }]);
    });

    it("does not mutate the input items array", () => {
        const items: Item[] = [{ id: 1, label: "a" }];
        const original = [...items];
        const ops = [{ id: 2, op: "add" as const, label: "b" }];
        applyArrayOperations(items, ops, getValue, keyFn);
        expect(items).toEqual(original);
    });

    it("preserves the original order of existing items", () => {
        const items: Item[] = [
            { id: 3, label: "c" },
            { id: 1, label: "a" },
            { id: 2, label: "b" },
        ];
        const ops = [{ id: 4, op: "add" as const, label: "d" }];
        const result = applyArrayOperations(items, ops, getValue, keyFn);
        expect(result.map((i) => i.id)).toEqual([3, 1, 2, 4]);
    });
});
