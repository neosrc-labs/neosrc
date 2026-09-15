import { describe, expect, it } from "vitest";
import type { ReviewComment } from "~/server/github";
import {
    groupReviewCommentThreads,
    isFileComment,
    isLineComment,
} from "./review-comment-threads";

const comment = (value: Record<string, unknown>) =>
    value as unknown as ReviewComment;

describe("review comment domain", () => {
    it("classifies explicit file comments and null-coordinate comments as file comments", () => {
        expect(isFileComment(comment({ subject_type: "file", line: 4 }))).toBe(
            true,
        );
        expect(isFileComment(comment({ line: null, position: null }))).toBe(
            true,
        );
        expect(isLineComment(comment({ line: null, position: null }))).toBe(
            false,
        );
    });

    it("classifies coordinate-bearing comments as line comments", () => {
        expect(isLineComment(comment({ line: 4, position: null }))).toBe(true);
        expect(isFileComment(comment({ line: 4, position: null }))).toBe(false);
    });

    it("keeps an outdated line comment out of the file-comment bucket", () => {
        // GitHub nulls `line` once the commented lines leave the diff but
        // keeps `original_line`; such a comment is not a file-level comment.
        const outdated = comment({
            line: null,
            position: null,
            original_line: 859,
        });
        expect(isFileComment(outdated)).toBe(false);
        expect(isLineComment(outdated)).toBe(true);
    });

    it("groups replies by their direct root without recursively collapsing replies", () => {
        const threads = groupReviewCommentThreads([
            comment({ id: 1 }),
            comment({ id: 2, in_reply_to_id: 1 }),
            comment({ id: 3, in_reply_to_id: 2 }),
        ]);
        expect(threads.map((thread) => thread.parent.id)).toEqual([1, 3]);
        expect(threads[0]?.replies.map((reply) => reply.id)).toEqual([2]);
    });

    it("returns one thread with empty replies for a standalone comment", () => {
        const threads = groupReviewCommentThreads([comment({ id: 1 })]);
        expect(threads).toHaveLength(1);
        expect(threads[0]?.parent.id).toBe(1);
        expect(threads[0]?.replies).toEqual([]);
    });

    it("groups parent with replies under the same root id", () => {
        const threads = groupReviewCommentThreads([
            comment({ id: 1 }),
            comment({ id: 2, in_reply_to_id: 1 }),
            comment({ id: 3, in_reply_to_id: 1 }),
        ]);
        expect(threads).toHaveLength(1);
        expect(threads[0]?.parent.id).toBe(1);
        expect(threads[0]?.replies).toHaveLength(2);
        expect(threads[0]?.replies.map((reply) => reply.id).sort()).toEqual([
            2, 3,
        ]);
    });

    it("handles multiple independent threads", () => {
        const threads = groupReviewCommentThreads([
            comment({ id: 1 }),
            comment({ id: 10, in_reply_to_id: 1 }),
            comment({ id: 2 }),
            comment({ id: 20, in_reply_to_id: 2 }),
        ]);
        expect(threads).toHaveLength(2);
        const thread1 = threads.find((thread) => thread.parent.id === 1);
        const thread2 = threads.find((thread) => thread.parent.id === 2);
        expect(thread1?.replies.map((reply) => reply.id)).toEqual([10]);
        expect(thread2?.replies.map((reply) => reply.id)).toEqual([20]);
    });

    it("treats a reply that arrives before its root as the thread root", () => {
        const threads = groupReviewCommentThreads([
            comment({ id: 2, in_reply_to_id: 1 }),
            comment({ id: 1 }),
        ]);
        expect(threads).toHaveLength(1);
        expect(threads[0]?.parent.id).toBe(2);
        expect(threads[0]?.replies.map((reply) => reply.id)).toEqual([1]);
    });

    it("returns no threads for no comments", () => {
        expect(groupReviewCommentThreads([])).toEqual([]);
    });
});
