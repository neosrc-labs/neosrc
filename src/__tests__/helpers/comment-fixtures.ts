import type { ReviewComment } from "~/server/github";

/**
 * Shared ReviewComment fixture factory. Comment-thread tests build comments
 * with this base and override only the fields their scenario needs.
 */
export function makeComment(
    overrides: Record<string, unknown> = {},
): ReviewComment {
    return {
        id: 1,
        body: "Test comment body",
        user: {
            login: "author-user",
            avatar_url: "https://example.com/avatar.png",
            id: 42,
            node_id: "MDQ6VXNlcjQy",
            gravatar_id: "",
            url: "https://api.github.com/users/author",
            received_events_url: "",
            type: "User" as const,
            site_admin: false,
            html_url: "https://github.com/author",
        },
        created_at: "2024-06-15T10:30:00Z",
        author_association: "MEMBER",
        path: "src/file.ts",
        line: 42,
        start_line: null,
        pull_request_review_id: null,
        url: "",
        node_id: "",
        diff_hunk: "",
        commit_id: "",
        original_commit_id: "",
        html_url: "",
        pull_request_url: "",
        _links: {
            self: { href: "" },
            html: { href: "" },
            pull_request: { href: "" },
        },
        reactions: {
            url: "",
            total_count: 0,
            "+1": 0,
            "-1": 0,
            laugh: 0,
            hooray: 0,
            confused: 0,
            heart: 0,
            rocket: 0,
            eyes: 0,
        },
        body_html: "",
        body_text: "",
        ...overrides,
    } as unknown as ReviewComment;
}
