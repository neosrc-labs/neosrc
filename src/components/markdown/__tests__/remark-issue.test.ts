// @vitest-environment node

import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { remarkIssuePlugin } from "../plugins/remark-issue";

function process(markdown: string, owner?: string, repo?: string): string {
    const result = unified()
        .use(remarkParse)
        .use(remarkIssuePlugin(owner, repo))
        .use(remarkStringify)
        .processSync(markdown);
    return String(result).trim();
}

describe("remarkIssuePlugin", () => {
    describe("owner/repo#123 references", () => {
        it("transforms owner/repo#123 into a link", () => {
            const output = process("See facebook/react#123 for details.");
            expect(output).toBe(
                "See [facebook/react#123](https://github.com/facebook/react/issues/123) for details.",
            );
        });

        it("transforms multiple owner/repo references in one text node", () => {
            const output = process("Fix facebook/react#456 and google/go#789.");
            expect(output).toBe(
                "Fix [facebook/react#456](https://github.com/facebook/react/issues/456) and [google/go#789](https://github.com/google/go/issues/789).",
            );
        });

        it("handles dots and hyphens in owner/repo names", () => {
            const output = process(
                "See my-user/my.repo#123 and my.user/my-repo#456.",
            );
            expect(output).toBe(
                "See [my-user/my.repo#123](https://github.com/my-user/my.repo/issues/123) and [my.user/my-repo#456](https://github.com/my.user/my-repo/issues/456).",
            );
        });

        it("transforms standalone owner/repo#123", () => {
            const output = process("facebook/react#123");
            expect(output).toBe(
                "[facebook/react#123](https://github.com/facebook/react/issues/123)",
            );
        });
    });

    describe("#123 references (context-dependent)", () => {
        it("transforms #123 when owner and repo are provided", () => {
            const output = process(
                "Fix #123 for details.",
                "facebook",
                "react",
            );
            expect(output).toBe(
                "Fix [#123](https://github.com/facebook/react/issues/123) for details.",
            );
        });

        it("leaves #123 as plain text when owner and repo are not provided", () => {
            const output = process("Fix #123 for details.");
            expect(output).toBe("Fix #123 for details.");
        });

        it("leaves #123 as plain text when only owner is provided", () => {
            const output = process("Fix #123 for details.", "facebook");
            expect(output).toBe("Fix #123 for details.");
        });

        it("leaves #123 as plain text when only repo is provided", () => {
            const output = process("Fix #123 for details.", undefined, "react");
            expect(output).toBe("Fix #123 for details.");
        });

        it("transforms multiple #123 references in one text node", () => {
            const output = process("Fix #123 and #456.", "facebook", "react");
            expect(output).toBe(
                "Fix [#123](https://github.com/facebook/react/issues/123) and [#456](https://github.com/facebook/react/issues/456).",
            );
        });
    });

    describe("mixed references", () => {
        it("handles owner/repo#123 and #123 in the same line", () => {
            const output = process(
                "See google/go#456 and #123.",
                "facebook",
                "react",
            );
            expect(output).toBe(
                "See [google/go#456](https://github.com/google/go/issues/456) and [#123](https://github.com/facebook/react/issues/123).",
            );
        });

        it("handles inline text mixed with multiple reference types", () => {
            const output = process(
                "Check user/repo#123, also #456.",
                "facebook",
                "react",
            );
            expect(output).toBe(
                "Check [user/repo#123](https://github.com/user/repo/issues/123), also [#456](https://github.com/facebook/react/issues/456).",
            );
        });
    });

    describe("no transformation inside code blocks", () => {
        it("does not transform #123 inside inline code", () => {
            const output = process("Use `#123` in your code.");
            expect(output).toBe("Use `#123` in your code.");
        });

        it("does not transform owner/repo#123 inside inline code", () => {
            const output = process("Check `user/repo#123`.");
            expect(output).toBe("Check `user/repo#123`.");
        });

        it("does not transform inside fenced code blocks", () => {
            const output = process("```\n#123\n```");
            expect(output).toBe("```\n#123\n```");
        });

        it("does not transform owner/repo#123 inside fenced code blocks", () => {
            const output = process("```\nuser/repo#123\n```");
            expect(output).toBe("```\nuser/repo#123\n```");
        });
    });

    describe("no double-wrapping inside existing links", () => {
        it("does not transform #123 when it is link text", () => {
            const output = process(
                "[click #123](https://example.com)",
                "owner",
                "repo",
            );
            expect(output).toBe("[click #123](https://example.com)");
        });

        it("does not transform owner/repo#123 when it is link text", () => {
            const output = process(
                "[click user/repo#123](https://example.com)",
            );
            expect(output).toBe("[click user/repo#123](https://example.com)");
        });
    });

    describe("false positive prevention", () => {
        it("does not match #123 when preceded by a word character (e.g. number#123)", () => {
            const output = process("number#123");
            expect(output).toBe("number#123");
        });

        it("does not match hex-like #abcdef1", () => {
            const output = process("The color #abcdef1 is blue.");
            expect(output).toBe("The color #abcdef1 is blue.");
        });

        it("does not match standalone # without following digits", () => {
            const output = process("Issue #abc.", "owner", "repo");
            expect(output).toBe("Issue #abc.");
        });

        it("does not match # at end of word without number", () => {
            const output = process("Tag#", "owner", "repo");
            expect(output).toBe("Tag#");
        });
    });
});
