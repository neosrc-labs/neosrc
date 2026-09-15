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
    const subjectType = (comment as Record<string, unknown>).subject_type;
    if (subjectType === "file") return true;
    if (subjectType === "line") return false;
    // Payloads without subject_type: a line comment always carries a line
    // number, current or original (an outdated comment keeps only the
    // original), while a file-level comment carries none.
    return (
        comment.line == null &&
        comment.original_line == null &&
        comment.position == null
    );
}

export function isLineComment(comment: ReviewComment): boolean {
    return !isFileComment(comment);
}
