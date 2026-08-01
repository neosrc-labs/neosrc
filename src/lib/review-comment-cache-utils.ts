/**
 * Returns a new flat comment list reflecting deletion of `commentId`.
 *
 * When the deleted comment has replies (children with `in_reply_to_id === commentId`),
 * the first reply is promoted to parent (`in_reply_to_id` omitted) and all
 * other replies are reparented under it. This matches GitHub's behavior: the first
 * chronological reply becomes the new thread root.
 *
 * Generic over `T` to preserve the exact comment type (e.g. `ReviewComment` vs
 * `PendingReview.comments` which differ in optionality of `position`).
 */
export function removeCommentFromFlatList<
    T extends { id: number; in_reply_to_id?: number | null },
>(comments: T[], commentId: number): T[] {
    const children = comments
        .filter((c) => c.in_reply_to_id === commentId)
        .sort((a, b) => a.id - b.id);

    if (children.length === 0) {
        return comments.filter((c) => c.id !== commentId);
    }
    const promoted = children[0];
    if (!promoted) return comments.filter((c) => c.id !== commentId);
    const promotedId = promoted.id;

    return comments
        .filter((c) => c.id !== commentId)
        .map((c) => {
            if (c.id === promotedId) {
                const { in_reply_to_id: _, ...rest } = c;
                return rest as T;
            }
            if (c.in_reply_to_id === commentId && c.id !== promotedId) {
                return { ...c, in_reply_to_id: promotedId };
            }
            return c;
        });
}
