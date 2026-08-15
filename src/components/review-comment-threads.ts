import type { ReviewComment } from "~/server/github";

export interface ReviewCommentThread {
    parent: ReviewComment;
    replies: ReviewComment[];
}

export function groupReviewCommentThreads(
    comments: ReviewComment[],
): ReviewCommentThread[] {
    const threads = new Map<number, ReviewComment[]>();
    for (const comment of comments) {
        const rootId = comment.in_reply_to_id ?? comment.id;
        const existing = threads.get(rootId) ?? [];
        existing.push(comment);
        threads.set(rootId, existing);
    }
    return Array.from(threads.values()).map((group) => ({
        parent: group[0] as ReviewComment,
        replies: group.slice(1),
    }));
}

export function isFileComment(comment: ReviewComment): boolean {
    const maybe = comment as Record<string, unknown>;
    return (
        maybe.subject_type === "file" ||
        (comment.line == null && comment.position == null)
    );
}

export function isLineComment(comment: ReviewComment): boolean {
    return !isFileComment(comment);
}
