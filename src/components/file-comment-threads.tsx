"use client";

import type { PullRequestPermissionContext } from "~/app/gh/[owner]/[repo]/pull/[number]/permissions-utils";
import type { ReviewComment } from "~/server/github";
import { InlineCommentThread } from "./inline-comment-thread";
import { groupReviewCommentThreads } from "./review-comment-threads";

export function FileCommentThreads({
    comments,
    owner,
    repo,
    pullNumber,
    pendingReviewId,
    permissionContext,
}: {
    comments: ReviewComment[];
    owner: string;
    repo: string;
    pullNumber: string;
    pendingReviewId?: number | null;
    permissionContext: PullRequestPermissionContext;
}) {
    return (
        <>
            {comments.length > 0 &&
                groupReviewCommentThreads(comments).map((thread) => (
                    <InlineCommentThread
                        key={`file-thread-${thread.parent.id}`}
                        parentComment={thread.parent}
                        replies={thread.replies}
                        owner={owner}
                        repo={repo}
                        number={Number(pullNumber)}
                        pendingReviewId={pendingReviewId}
                        permissionContext={permissionContext}
                    />
                ))}
        </>
    );
}
