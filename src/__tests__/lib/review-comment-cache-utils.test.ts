// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { removeCommentFromFlatList } from "~/lib/review-comment-cache-utils";
import type { ReviewComment } from "~/server/github";

function c(overrides: {
    id: number;
    in_reply_to_id?: number | null;
}): ReviewComment {
    return overrides as unknown as ReviewComment;
}

describe("removeCommentFromFlatList", () => {
    it("deletes standalone comment with no replies", () => {
        const input = [c({ id: 1 }), c({ id: 2 })];
        const result = removeCommentFromFlatList(input, 1);
        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe(2);
    });

    it("promotes first reply when deleting parent with one reply", () => {
        const input = [c({ id: 1 }), c({ id: 2, in_reply_to_id: 1 })];
        const result = removeCommentFromFlatList(input, 1);
        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe(2);
        expect(result[0]?.in_reply_to_id).toBeUndefined();
    });

    it("promotes first reply and reparents remaining when deleting parent with two replies", () => {
        const input = [
            c({ id: 1 }),
            c({ id: 2, in_reply_to_id: 1 }),
            c({ id: 3, in_reply_to_id: 1 }),
        ];
        const result = removeCommentFromFlatList(input, 1);
        expect(result).toHaveLength(2);

        const promoted = result.find((r) => r.id === 2);
        const reparented = result.find((r) => r.id === 3);

        expect(promoted).toBeDefined();
        expect(promoted?.in_reply_to_id).toBeUndefined();
        expect(reparented).toBeDefined();
        expect(reparented?.in_reply_to_id).toBe(2);
    });

    it("only affects the target thread, leaving unrelated comments unchanged", () => {
        const input = [
            c({ id: 1 }),
            c({ id: 2, in_reply_to_id: 1 }),
            c({ id: 3, in_reply_to_id: 1 }),
            c({ id: 10 }),
            c({ id: 20, in_reply_to_id: 10 }),
        ];
        const result = removeCommentFromFlatList(input, 1);
        expect(result).toHaveLength(4);

        const thread10 = result.filter(
            (r) => r.id === 10 || r.id === 20 || r.in_reply_to_id === 10,
        );
        expect(thread10).toHaveLength(2);

        const promoted = result.find((r) => r.id === 2);
        expect(promoted?.in_reply_to_id).toBeUndefined();

        const reparented = result.find((r) => r.id === 3);
        expect(reparented?.in_reply_to_id).toBe(2);
    });

    it("deletes a reply (not a parent), leaving parent and siblings unchanged", () => {
        const input = [
            c({ id: 1 }),
            c({ id: 2, in_reply_to_id: 1 }),
            c({ id: 3, in_reply_to_id: 1 }),
        ];
        const result = removeCommentFromFlatList(input, 2);
        expect(result).toHaveLength(2);

        const parent = result.find((r) => r.id === 1);
        const sibling = result.find((r) => r.id === 3);

        expect(parent).toBeDefined();
        expect(parent?.in_reply_to_id).toBeUndefined();
        expect(sibling).toBeDefined();
        expect(sibling?.in_reply_to_id).toBe(1);
    });

    it("returns empty array for empty input", () => {
        expect(removeCommentFromFlatList([], 1)).toEqual([]);
    });

    it("returns input unchanged when commentId is not present", () => {
        const input = [c({ id: 1 }), c({ id: 2 })];
        const result = removeCommentFromFlatList(input, 99);
        expect(result).toEqual(input);
    });

    it("handles pending stub comments with negative ids", () => {
        const input = [
            c({ id: -1 }),
            c({ id: -2, in_reply_to_id: -1 }),
            c({ id: -3, in_reply_to_id: -1 }),
        ];
        const result = removeCommentFromFlatList(input, -1);
        expect(result).toHaveLength(2);

        // Ascending sort: -3 < -2, so -3 is promoted, -2 reparented under -3
        const promoted = result.find((r) => r.id === -3);
        const reparented = result.find((r) => r.id === -2);

        expect(promoted?.in_reply_to_id).toBeUndefined();
        expect(reparented?.in_reply_to_id).toBe(-3);
    });
});
