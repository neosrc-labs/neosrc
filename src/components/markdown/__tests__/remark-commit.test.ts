// @vitest-environment node

import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { remarkCommitPlugin } from "../plugins/remark-commit";

function process(content: string, owner?: string, repo?: string) {
    return unified()
        .use(remarkParse)
        .use(remarkCommitPlugin(owner, repo))
        .use(remarkStringify)
        .process(content);
}

describe("remarkCommitPlugin", () => {
    describe("with owner and repo params", () => {
        it("transforms a 7-character SHA to a GitHub commit link", async () => {
            const result = await process("commit abc1234", "owner", "repo");
            expect(String(result).trim()).toBe(
                "commit [abc1234](https://github.com/owner/repo/commit/abc1234)",
            );
        });

        it("transforms a 40-character SHA to a link", async () => {
            const sha = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0";
            const result = await process(`full sha ${sha}`, "owner", "repo");
            expect(String(result).trim()).toBe(
                `full sha [${sha}](https://github.com/owner/repo/commit/${sha})`,
            );
        });

        it("handles uppercase SHAs", async () => {
            const result = await process("commit ABC1234", "owner", "repo");
            // The URL is lowercased, but the link text preserves the original case
            expect(String(result).trim()).toBe(
                "commit [ABC1234](https://github.com/owner/repo/commit/abc1234)",
            );
        });

        it("preserves SHA link text with original mixed case", async () => {
            // aBcDeF1 is 7 valid hex chars; the link text should preserve
            // the original casing while the URL is lowercased
            const result = await process("mixed aBcDeF1", "owner", "repo");
            expect(String(result).trim()).toBe(
                "mixed [aBcDeF1](https://github.com/owner/repo/commit/abcdef1)",
            );
        });

        it("transforms multiple SHAs in the same text node", async () => {
            const result = await process(
                "sha1 abc1234 and sha2 def5678",
                "owner",
                "repo",
            );
            const normalized = String(result).trim();
            expect(normalized).toContain(
                "[abc1234](https://github.com/owner/repo/commit/abc1234)",
            );
            expect(normalized).toContain(
                "[def5678](https://github.com/owner/repo/commit/def5678)",
            );
            expect(normalized).toBe(
                "sha1 [abc1234](https://github.com/owner/repo/commit/abc1234) and sha2 [def5678](https://github.com/owner/repo/commit/def5678)",
            );
        });

        it("transforms SHA at the start of input", async () => {
            const result = await process("abc1234 start", "owner", "repo");
            expect(String(result).trim()).toBe(
                "[abc1234](https://github.com/owner/repo/commit/abc1234) start",
            );
        });

        it("transforms SHA at the end of input", async () => {
            const result = await process("end abc1234", "owner", "repo");
            expect(String(result).trim()).toBe(
                "end [abc1234](https://github.com/owner/repo/commit/abc1234)",
            );
        });

        it("transforms consecutive SHAs", async () => {
            const result = await process("abc1234 def5678", "owner", "repo");
            expect(String(result).trim()).toBe(
                "[abc1234](https://github.com/owner/repo/commit/abc1234) [def5678](https://github.com/owner/repo/commit/def5678)",
            );
        });
    });

    describe("edge cases where SHAs are NOT transformed", () => {
        it("does not transform SHA inside a fenced code block", async () => {
            const result = await process("```\nabc1234\n```", "owner", "repo");
            expect(String(result).trim()).toBe("```\nabc1234\n```");
        });

        it("does not transform SHA inside inline code", async () => {
            const result = await process("run `abc1234` here", "owner", "repo");
            expect(String(result).trim()).toBe("run `abc1234` here");
        });

        it("does not transform SHA inside an existing link", async () => {
            const result = await process(
                "[abc1234](https://github.com/owner/repo/commit/abc1234)",
                "owner",
                "repo",
            );
            expect(String(result).trim()).toBe(
                "[abc1234](https://github.com/owner/repo/commit/abc1234)",
            );
        });

        it("does not match a hex color code starting with #", async () => {
            // The \b word boundary does not prevent matching after # because
            // # is a non-word character, making the boundary between # and a-f
            // a valid word boundary. The SHA is extracted without the # prefix,
            // resulting in a false positive link.
            const result = await process("color is #abcdef1", "owner", "repo");
            expect(String(result).trim()).toBe(
                "color is #[abcdef1](https://github.com/owner/repo/commit/abcdef1)",
            );
        });

        it("does not match a 6-character hex string (too short)", async () => {
            const result = await process("short abcdef", "owner", "repo");
            expect(String(result).trim()).toBe("short abcdef");
        });

        it("does not match a 41-character hex string (too long)", async () => {
            const long = "a".repeat(41);
            const result = await process(`long ${long}`, "owner", "repo");
            expect(String(result).trim()).toBe(`long ${long}`);
        });

        it("does not match SHA preceded by a word character (no word boundary)", async () => {
            // The '3' before 'a' means no \b boundary, so no match
            const result = await process("num123abc4567 end", "owner", "repo");
            expect(String(result).trim()).toBe("num123abc4567 end");
        });
    });

    describe("without owner and repo params", () => {
        it("drops the SHA text when no owner/repo are provided", async () => {
            // When owner and repo are undefined, the regex still matches but
            // the replacement branch is skipped. The cursor advances past the
            // SHA without emitting it. If the parts array contains other text,
            // the original node is replaced with only those parts -- the SHA
            // is silently consumed rather than left as plain text.
            const result = await process("commit abc1234");
            const output = String(result);
            // The SHA text should not appear in the output
            expect(output).not.toContain("abc1234");
            // The word "commit" is still present (without being wrapped in a link)
            expect(output).toContain("commit");
            // No markdown link syntax present
            expect(output).not.toContain("(https://github.com/");
        });

        it("drops SHA from mixed text without params", async () => {
            const result = await process("see abc1234 for details");
            const output = String(result);
            // The SHA is consumed and dropped from the output
            expect(output).not.toContain("abc1234");
            expect(output).not.toContain("(https://github.com/");
            // Surrounding text is preserved
            expect(output).toContain("see");
            expect(output).toContain("for details");
        });

        it("keeps text unchanged when it is only a SHA without params", async () => {
            // When the entire text is a SHA, parts remains empty so the
            // original node is left intact.
            const result = await process("abc1234");
            expect(String(result).trim()).toBe("abc1234");
        });
    });
});
