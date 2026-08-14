// eslint-disable-next-line import/no-extraneous-dependencies
import remarkParse from "remark-parse";
// eslint-disable-next-line import/no-extraneous-dependencies
import remarkStringify from "remark-stringify";

// NOTE: unified, remark-parse, and remark-stringify are transitive
// dependencies via react-markdown and are resolved by pnpm.
// eslint-disable-next-line import/no-extraneous-dependencies
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { remarkMentionPlugin } from "../plugins/remark-mention";

function format(input: string): string {
    const file = unified()
        .use(remarkParse)
        .use(remarkMentionPlugin)
        .use(remarkStringify)
        .processSync(input);
    return String(file);
}

describe("remark-mention plugin", () => {
    it("transforms @user to user link", () => {
        const result = format("Hello @user");
        expect(result).toContain("[@user](https://github.com/user)");
    });

    it("transforms @org/team to team link", () => {
        const result = format("Hello @my-org/my-team");
        expect(result).toContain(
            "[@my-org/my-team](https://github.com/orgs/my-org/teams/my-team)",
        );
    });

    it("handles multiple mentions in one text", () => {
        const result = format("Hey @alice and @bob");
        expect(result).toContain("[@alice](https://github.com/alice)");
        expect(result).toContain("[@bob](https://github.com/bob)");
    });

    it("skips mentions inside inline code blocks", () => {
        const result = format("Use `@user` in code");
        expect(result).not.toContain("https://github.com/user");
        // The @user should remain as literal text inside backticks
        expect(result).toContain("`@user`");
    });

    it("skips mentions inside fenced code blocks", () => {
        const result = format("```\n@user\n```");
        expect(result).not.toContain("https://github.com/user");
    });

    it("skips mentions inside existing links", () => {
        const result = format("[click @user](https://example.com)");
        // The mention inside the link text should not be replaced
        expect(result).not.toContain("https://github.com/user");
        // The original link should remain intact
        expect(result).toContain("[click @user](https://example.com)");
    });

    it("handles single-character username @a", () => {
        const result = format("Contact @a");
        expect(result).toContain("[@a](https://github.com/a)");
    });
});
