// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { groupThreads } from "~/components/DiffView";
import type { ReviewComment } from "~/server/github";

type MockComment = {
    id: number;
    in_reply_to_id?: number;
    body?: string;
};

function c(overrides: MockComment): ReviewComment {
    return overrides as unknown as ReviewComment;
}

describe("groupThreads", () => {
    it("returns one thread with empty replies for a standalone comment", () => {
        const threads = groupThreads([c({ id: 1 })]);
        expect(threads).toHaveLength(1);
        expect(threads[0]?.parent.id).toBe(1);
        expect(threads[0]?.replies).toEqual([]);
    });

    it("groups parent with replies under the same root id", () => {
        const threads = groupThreads([
            c({ id: 1 }),
            c({ id: 2, in_reply_to_id: 1 }),
            c({ id: 3, in_reply_to_id: 1 }),
        ]);
        expect(threads).toHaveLength(1);
        expect(threads[0]?.parent.id).toBe(1);
        expect(threads[0]?.replies).toHaveLength(2);
        const replyIds = threads[0]?.replies.map((r) => r.id).sort();
        expect(replyIds).toEqual([2, 3]);
    });

    it("handles multiple independent threads", () => {
        const threads = groupThreads([
            c({ id: 1 }),
            c({ id: 10, in_reply_to_id: 1 }),
            c({ id: 2 }),
            c({ id: 20, in_reply_to_id: 2 }),
        ]);
        expect(threads).toHaveLength(2);
        const thread1 = threads.find((t) => t.parent.id === 1);
        const thread2 = threads.find((t) => t.parent.id === 2);
        expect(thread1).toBeDefined();
        expect(thread2).toBeDefined();
        expect(thread1?.replies).toHaveLength(1);
        expect(thread1?.replies[0]?.id).toBe(10);
        expect(thread2?.replies).toHaveLength(1);
        expect(thread2?.replies[0]?.id).toBe(20);
    });

    it("groups by in_reply_to_id (out-of-order input uses first element as parent)", () => {
        const threads = groupThreads([
            c({ id: 2, in_reply_to_id: 1 }),
            c({ id: 1 }),
        ]);
        expect(threads).toHaveLength(1);
        expect(threads[0]?.parent.id).toBe(2);
        expect(threads[0]?.replies).toHaveLength(1);
        expect(threads[0]?.replies[0]?.id).toBe(1);
    });

    it("nested reply (reply to a reply) becomes a separate thread root", () => {
        const threads = groupThreads([
            c({ id: 1 }),
            c({ id: 2, in_reply_to_id: 1 }),
            c({ id: 3, in_reply_to_id: 2 }),
        ]);
        expect(threads).toHaveLength(2);
        const t1 = threads.find((t) => t.parent.id === 1);
        const t2 = threads.find((t) => t.parent.id === 3);
        expect(t1).toBeDefined();
        expect(t2).toBeDefined();
        expect(t1?.replies).toHaveLength(1);
        expect(t1?.replies[0]?.id).toBe(2);
        expect(t2?.replies).toHaveLength(0);
    });

    it("returns empty array for no comments", () => {
        expect(groupThreads([])).toEqual([]);
    });
});
