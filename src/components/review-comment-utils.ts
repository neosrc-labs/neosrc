import type { ReviewComment } from "~/server/github";

interface CreateReviewCommentStubParams {
    body: string;
    filePath: string;
    currentUser: { login: string; avatarUrl: string };
    lineNumber?: number;
    side?: "LEFT" | "RIGHT";
    startLineNumber?: number;
    startSide?: "LEFT" | "RIGHT" | null;
    inReplyTo?: number;
    pendingReviewId?: number | null;
}

export function createReviewCommentStub(
    params: CreateReviewCommentStubParams,
): ReviewComment {
    const {
        body,
        filePath,
        currentUser,
        lineNumber,
        side,
        startLineNumber,
        startSide,
        inReplyTo,
        pendingReviewId,
    } = params;

    const now = new Date().toISOString();
    const tempId = -Date.now();
    const isFileLevel = lineNumber == null;

    return {
        url: "",
        pull_request_review_id: pendingReviewId ?? null,
        id: tempId,
        node_id: "",
        diff_hunk: "",
        path: filePath,
        commit_id: "",
        original_commit_id: "",
        user: {
            login: currentUser.login,
            id: 0,
            node_id: "",
            avatar_url: currentUser.avatarUrl,
            gravatar_id: null,
            url: "",
            html_url: "",
            followers_url: "",
            following_url: "",
            gists_url: "",
            starred_url: "",
            subscriptions_url: "",
            organizations_url: "",
            repos_url: "",
            events_url: "",
            received_events_url: "",
            type: "User",
            user_view_type: "public",
            site_admin: false,
        },
        body,
        created_at: now,
        updated_at: now,
        html_url: "",
        pull_request_url: "",
        author_association: "NONE",
        _links: {
            self: { href: "" },
            html: { href: "" },
            pull_request: { href: "" },
        },
        ...(lineNumber != null && { line: lineNumber }),
        ...(side != null && { side }),
        ...(startLineNumber != null && { start_line: startLineNumber }),
        ...(startSide != null && { start_side: startSide }),
        ...(inReplyTo != null && { in_reply_to_id: inReplyTo }),
        ...(isFileLevel && { subject_type: "file" as const }),
        reactions: {
            url: "",
            total_count: 0,
            "+1": 0,
            "-1": 0,
            laugh: 0,
            confused: 0,
            heart: 0,
            hooray: 0,
            rocket: 0,
            eyes: 0,
        },
        body_html: "",
        body_text: body,
    } as ReviewComment;
}
