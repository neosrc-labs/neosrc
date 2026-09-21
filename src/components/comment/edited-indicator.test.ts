import { describe, expect, it } from "vitest";
import { getCommentLastEdit } from "~/components/comment/edited-indicator";
import type {
    GQLIssueComment,
    GQLPullRequestReview,
} from "~/server/github-graphql";

const EDITOR = {
    __typename: "User",
    login: "ann",
    avatarUrl: "https://avatars/ann",
    url: "https://github.com/ann",
};

function issueComment(edits: GQLIssueComment["edits"]): GQLIssueComment {
    return {
        __typename: "IssueComment",
        id: "c1",
        databaseId: 1,
        body: "body",
        author: EDITOR,
        createdAt: "2026-01-01T00:00:00Z",
        authorAssociation: "NONE",
        isMinimized: false,
        minimizedReason: null,
        reactions: { nodes: [] },
        edits,
    };
}

function pullRequestReview(
    edits: GQLPullRequestReview["edits"],
): GQLPullRequestReview {
    return {
        __typename: "PullRequestReview",
        id: "r1",
        databaseId: 2,
        state: "APPROVED",
        body: "body",
        author: EDITOR,
        authorAssociation: "NONE",
        submittedAt: "2026-01-01T00:00:00Z",
        createdAt: "2026-01-01T00:00:00Z",
        isMinimized: false,
        minimizedReason: null,
        reactions: { nodes: [] },
        edits,
    };
}

describe("getCommentLastEdit", () => {
    it("returns the first non-null edit node", () => {
        const summary = getCommentLastEdit(
            issueComment({
                nodes: [
                    null,
                    {
                        editedAt: "2026-01-02T00:00:00Z",
                        editor: null,
                    },
                    {
                        editedAt: "2026-01-03T00:00:00Z",
                        editor: EDITOR,
                    },
                ],
            }),
        );

        expect(summary).toEqual({
            editedAt: "2026-01-02T00:00:00Z",
            editor: null,
        });
    });

    it("returns null when edits are missing or empty", () => {
        expect(getCommentLastEdit(issueComment(undefined))).toBeNull();
        expect(getCommentLastEdit(issueComment({ nodes: null }))).toBeNull();
        expect(getCommentLastEdit(issueComment({ nodes: [null] }))).toBeNull();
    });

    it("works on PullRequestReview bodies", () => {
        const summary = getCommentLastEdit(
            pullRequestReview({
                nodes: [{ editedAt: "2026-02-01T12:00:00Z", editor: EDITOR }],
            }),
        );

        expect(summary).toEqual({
            editedAt: "2026-02-01T12:00:00Z",
            editor: EDITOR,
        });
    });
});
