import { describe, expect, it } from "vitest";
import {
    createReviewCommentStub,
    findAuthorAssociation,
} from "./review-comment-utils";

describe("findAuthorAssociation", () => {
    const comments = [
        { user: { login: "user1" }, author_association: "CONTRIBUTOR" },
        { user: { login: "user2" }, author_association: "MEMBER" },
        { user: { login: "user3" } },
    ];

    it("returns association when user is found", () => {
        expect(findAuthorAssociation(comments, "user1")).toBe("CONTRIBUTOR");
    });

    it("returns undefined when user is not found", () => {
        expect(findAuthorAssociation(comments, "unknown")).toBeUndefined();
    });

    it("returns undefined for empty login", () => {
        expect(findAuthorAssociation(comments, "")).toBeUndefined();
    });

    it("handles null user in comments gracefully", () => {
        const commentsWithNull = [
            { user: null },
            { user: { login: "user1" }, author_association: "OWNER" },
        ];
        expect(findAuthorAssociation(commentsWithNull, "user1")).toBe("OWNER");
    });

    it("returns undefined for comments without author_association", () => {
        expect(findAuthorAssociation(comments, "user3")).toBeUndefined();
    });
});

describe("createReviewCommentStub", () => {
    const currentUser = {
        login: "testuser",
        avatarUrl: "https://example.com/avatar.png",
    };

    it("creates a basic stub with required params", () => {
        const stub = createReviewCommentStub({
            body: "test comment",
            filePath: "src/file.ts",
            currentUser,
        });
        expect(stub.body).toBe("test comment");
        expect(stub.path).toBe("src/file.ts");
        expect(stub.user?.login).toBe("testuser");
        expect(stub.id).toBeLessThan(0); // negative temp id
        expect(stub.pull_request_review_id).toBeNull();
    });

    it("sets side and startSide correctly", () => {
        const stub = createReviewCommentStub({
            body: "test",
            filePath: "f.ts",
            currentUser,
            side: "LEFT",
            startSide: "RIGHT",
        });
        expect(stub.side).toBe("LEFT");
        expect(stub.start_side).toBe("RIGHT");
    });

    it("creates a stub with negative temp id", () => {
        const stub = createReviewCommentStub({
            body: "test",
            filePath: "f.ts",
            currentUser,
        });
        expect(stub.id).toBeLessThan(0);
    });

    it("uses pendingReviewId when provided", () => {
        const stub = createReviewCommentStub({
            body: "test",
            filePath: "f.ts",
            currentUser,
            pendingReviewId: 42,
        });
        expect(stub.pull_request_review_id).toBe(42);
    });

    it("creates file-level comment when no lineNumber", () => {
        const stub = createReviewCommentStub({
            body: "file comment",
            filePath: "f.ts",
            currentUser,
        });
        expect(stub.subject_type).toBe("file");
        expect(stub.line).toBeUndefined();
    });

    it("creates line-level comment when lineNumber provided", () => {
        const stub = createReviewCommentStub({
            body: "line comment",
            filePath: "f.ts",
            currentUser,
            lineNumber: 10,
            side: "RIGHT",
        });
        expect(stub.line).toBe(10);
        expect(stub.side).toBe("RIGHT");
        expect(stub.subject_type).toBeUndefined();
    });
});
