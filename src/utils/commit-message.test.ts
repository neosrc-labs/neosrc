import { describe, expect, it } from "vitest";
import { parseCommitMessage } from "./commit-message";

describe("parseCommitMessage", () => {
    describe("subject / body splitting", () => {
        it("splits a single-line message into subject + empty body", () => {
            const result = parseCommitMessage("feat: add login");
            expect(result.subject).toBe("feat: add login");
            expect(result.body).toBe("");
        });

        it("splits a multi-line message into subject and body", () => {
            const result = parseCommitMessage(
                "feat: add login\n\nThis adds a login form.\nIt validates email.",
            );
            expect(result.subject).toBe("feat: add login");
            expect(result.body).toBe(
                "This adds a login form.\nIt validates email.",
            );
        });

        it("trims leading whitespace from the body", () => {
            const result = parseCommitMessage(
                "fix: patch leak\n\n\n\nDetails here",
            );
            expect(result.body).toBe("Details here");
        });

        it("returns empty subject and body for empty input", () => {
            const result = parseCommitMessage("");
            expect(result.subject).toBe("");
            expect(result.body).toBe("");
            expect(result.conventional).toBeNull();
        });
    });

    describe("conventional parsing", () => {
        it("parses a basic conventional commit without scope", () => {
            const result = parseCommitMessage("feat: add login");
            expect(result.conventional).toEqual({
                type: "feat",
                scope: null,
                breaking: false,
                description: "add login",
            });
        });

        it("parses a conventional commit with a scope", () => {
            const result = parseCommitMessage("feat(auth): add login");
            expect(result.conventional).toEqual({
                type: "feat",
                scope: "auth",
                breaking: false,
                description: "add login",
            });
        });

        it("lowercases the type", () => {
            const result = parseCommitMessage("FEAT: add login");
            expect(result.conventional?.type).toBe("feat");
        });

        it("preserves scope casing", () => {
            const result = parseCommitMessage("feat(AuthModule): add login");
            expect(result.conventional?.scope).toBe("AuthModule");
        });

        it("parses multi-line conventional commit with body", () => {
            const result = parseCommitMessage(
                "feat(auth): add login\n\nDetailed body text.",
            );
            expect(result.conventional?.description).toBe("add login");
            expect(result.body).toBe("Detailed body text.");
        });

        it("treats unknown types as still conventional", () => {
            const result = parseCommitMessage("improve: speed up render");
            expect(result.conventional?.type).toBe("improve");
            expect(result.conventional?.description).toBe("speed up render");
        });
    });

    describe("breaking changes", () => {
        it("flags the `!` form as breaking", () => {
            const result = parseCommitMessage("feat!: drop Node 16 support");
            expect(result.conventional?.breaking).toBe(true);
            expect(result.conventional?.description).toBe(
                "drop Node 16 support",
            );
        });

        it("flags the scoped `!` form as breaking", () => {
            const result = parseCommitMessage(
                "feat(auth)!: redesign login flow",
            );
            expect(result.conventional?.breaking).toBe(true);
            expect(result.conventional?.scope).toBe("auth");
            expect(result.conventional?.description).toBe(
                "redesign login flow",
            );
        });

        it("flags a BREAKING CHANGE: footer as breaking", () => {
            const result = parseCommitMessage(
                "feat: add login\n\nAdds login.\n\nBREAKING CHANGE: removes legacy auth",
            );
            expect(result.conventional?.breaking).toBe(true);
        });

        it("flags a BREAKING-CHANGE (hyphen) footer as breaking", () => {
            const result = parseCommitMessage(
                "feat: add login\n\nBREAKING-CHANGE: removes legacy auth",
            );
            expect(result.conventional?.breaking).toBe(true);
        });

        it("does not flag a non-breaking commit", () => {
            const result = parseCommitMessage("feat: add login");
            expect(result.conventional?.breaking).toBe(false);
        });

        it("does not treat body text mentioning 'breaking' as a breaking footer", () => {
            const result = parseCommitMessage(
                "docs: update guide\n\nThis is not a breaking change.",
            );
            expect(result.conventional?.breaking).toBe(false);
        });
    });

    describe("non-conventional subjects", () => {
        it("returns conventional=null for a plain subject", () => {
            const result = parseCommitMessage("update README");
            expect(result.conventional).toBeNull();
            expect(result.subject).toBe("update README");
        });

        it("returns conventional=null when the type has no colon", () => {
            const result = parseCommitMessage("feat add login");
            expect(result.conventional).toBeNull();
        });

        it("returns conventional=null when the colon has no preceding type", () => {
            const result = parseCommitMessage(": add login");
            expect(result.conventional).toBeNull();
        });

        it("returns conventional=null for a merge commit subject", () => {
            const result = parseCommitMessage(
                "Merge pull request #42 from owner/branch",
            );
            expect(result.conventional).toBeNull();
        });
    });
});
