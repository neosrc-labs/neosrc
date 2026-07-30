// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { remarkEmojiPlugin } from "./remark-emoji";

/**
 * Helper: call the plugin transformer on a mock mdast tree.
 * Returns the tree (mutated in place) for assertions.
 */
// biome-ignore lint/suspicious/noExplicitAny: AST transformer
function transform(tree: any): any {
    const transformer = remarkEmojiPlugin();
    transformer(tree);
    return tree;
}

// biome-ignore lint/suspicious/noExplicitAny: AST node factory
function text(value: string): any {
    return { type: "text", value };
}

// biome-ignore lint/suspicious/noExplicitAny: AST node factory
function inlineCode(value: string): any {
    return { type: "inlineCode", value };
}

// biome-ignore lint/suspicious/noExplicitAny: AST node factory
function codeBlock(value: string): any {
    return { type: "code", value, lang: "text" };
}

describe("remarkEmojiPlugin", () => {
    it("transforms :smile: to emoji character", () => {
        const tree = {
            type: "root",
            children: [{ type: "paragraph", children: [text(":smile:")] }],
        };
        transform(tree);
        expect(tree.children[0]?.children[0]?.value).toBe("😄");
    });

    it("transforms multiple emoji shortcodes", () => {
        const tree = {
            type: "root",
            children: [
                { type: "paragraph", children: [text(":smile: :wave:")] },
            ],
        };
        transform(tree);
        expect(tree.children[0]?.children[0]?.value).toBe("😄 👋");
    });

    it("transforms emoji in mixed text", () => {
        const tree = {
            type: "root",
            children: [
                {
                    type: "paragraph",
                    children: [text("Hello :smile: world!")],
                },
            ],
        };
        transform(tree);
        expect(tree.children[0]?.children[0]?.value).toBe("Hello 😄 world!");
    });

    it("does not transform inside inlineCode", () => {
        const tree = {
            type: "root",
            children: [
                {
                    type: "paragraph",
                    children: [inlineCode(":smile:")],
                },
            ],
        };
        transform(tree);
        // inlineCode nodes store code in `value`, not `children`
        expect(tree.children[0]?.children[0]?.value).toBe(":smile:");
    });

    it("does not transform inside code blocks", () => {
        const tree = {
            type: "root",
            children: [
                {
                    type: "paragraph",
                    children: [codeBlock(":smile:")],
                },
            ],
        };
        transform(tree);
        expect(tree.children[0]?.children[0]?.value).toBe(":smile:");
    });

    it("leaves unknown shortcodes unchanged", () => {
        const tree = {
            type: "root",
            children: [
                {
                    type: "paragraph",
                    children: [text(":unknown_code:")],
                },
            ],
        };
        transform(tree);
        expect(tree.children[0]?.children[0]?.value).toBe(":unknown_code:");
    });

    it("handles empty text node", () => {
        const tree = {
            type: "root",
            children: [{ type: "paragraph", children: [text("")] }],
        };
        transform(tree);
        expect(tree.children[0]?.children[0]?.value).toBe("");
    });

    it("handles text with no shortcodes", () => {
        const tree = {
            type: "root",
            children: [
                {
                    type: "paragraph",
                    children: [text("plain text with no emoji")],
                },
            ],
        };
        transform(tree);
        expect(tree.children[0]?.children[0]?.value).toBe(
            "plain text with no emoji",
        );
    });

    it("handles deeply nested text nodes", () => {
        const tree = {
            type: "root",
            children: [
                {
                    type: "blockquote",
                    children: [
                        {
                            type: "paragraph",
                            children: [text("nested :wave:")],
                        },
                    ],
                },
            ],
        };
        transform(tree);
        expect(tree.children[0]?.children[0]?.children[0]?.value).toBe(
            "nested 👋",
        );
    });
});
