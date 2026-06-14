import { describe, expect, it } from "vitest";
import {
    applyCodeBlockFormat,
    applyInlineFormat,
    applyListFormat,
    findEnclosingCodeBlock,
    findLineStart,
    getLinePrefix,
    getListPrefixLength,
    getNextOrderedNumber,
    handleEnterKey,
} from "./markdown-utils";

describe("findLineStart", () => {
    it("returns 0 for position 0 in a single line", () => {
        expect(findLineStart("hello world", 0)).toBe(0);
    });

    it("returns 0 for position in the first line", () => {
        expect(findLineStart("hello world", 5)).toBe(0);
    });

    it("returns position after last newline for multi-line text", () => {
        expect(findLineStart("line1\nline2\nline3", 14)).toBe(12);
    });

    it("returns position of the newline + 1 when cursor is at the start of a line", () => {
        expect(findLineStart("a\nb\nc", 2)).toBe(2);
    });
});

describe("getListPrefixLength", () => {
    it("returns 6 for unchecked task list items", () => {
        expect(getListPrefixLength("- [ ] task")).toBe(6);
    });

    it("returns 6 for checked task list items", () => {
        expect(getListPrefixLength("- [x] done")).toBe(6);
    });

    it("returns 2 for unordered list items", () => {
        expect(getListPrefixLength("- item")).toBe(2);
    });

    it("returns correct length for ordered list items", () => {
        expect(getListPrefixLength("1. item")).toBe(3);
        expect(getListPrefixLength("42. answer")).toBe(4);
        expect(getListPrefixLength("100. items")).toBe(5);
    });

    it("returns 0 for plain text", () => {
        expect(getListPrefixLength("hello world")).toBe(0);
    });

    it("returns 0 for empty string", () => {
        expect(getListPrefixLength("")).toBe(0);
    });

    it("returns 0 for blockquote", () => {
        expect(getListPrefixLength("> quote")).toBe(0);
    });
});

describe("findEnclosingCodeBlock", () => {
    const codeExample = "before\n```\ncode\n```\nafter";

    it("returns null when cursor is before the code block", () => {
        expect(findEnclosingCodeBlock(codeExample, 3)).toBeNull();
    });

    it("returns null when cursor is after the code block", () => {
        const pos = codeExample.length - 1;
        expect(findEnclosingCodeBlock(codeExample, pos)).toBeNull();
    });

    it("returns null when cursor is on the opening fence", () => {
        const pos = codeExample.indexOf("```");
        expect(findEnclosingCodeBlock(codeExample, pos)).toBeNull();
    });

    it("returns null when cursor is on the closing fence", () => {
        const pos = codeExample.lastIndexOf("```");
        expect(findEnclosingCodeBlock(codeExample, pos)).toBeNull();
    });

    it("returns block positions when cursor is inside the code block", () => {
        const result = findEnclosingCodeBlock(codeExample, 12);
        expect(result).not.toBeNull();
        expect(result?.openStart).toBe(7);
        expect(result?.closeStart).toBe(16);
    });

    it("detects code block with language identifier", () => {
        const text = "a\n```ts\nconst x = 1;\n```\nb";
        const result = findEnclosingCodeBlock(text, 15);
        expect(result).not.toBeNull();
    });

    it("returns null when there's no code block at all", () => {
        expect(findEnclosingCodeBlock("just plain text", 5)).toBeNull();
    });

    it("handles multiple code blocks - returns correct one", () => {
        const text = "a\n```\nfirst\n```\nb\n```\nsecond\n```\nc";
        const result = findEnclosingCodeBlock(text, 25);
        expect(result).not.toBeNull();
        const content = text.slice(result?.openEnd, result?.closeStart).trim();
        expect(content).toBe("second");
    });
});

describe("applyInlineFormat", () => {
    describe("with selected text", () => {
        it("wraps selected text with delimiter", () => {
            const result = applyInlineFormat("hello world", 0, 5, "**", "bold");
            expect(result.newText).toBe("**hello** world");
            expect(result.newStart).toBe(0);
            expect(result.newEnd).toBe(9);
        });

        it("wraps selected text with backtick delimiter", () => {
            const result = applyInlineFormat(
                "use the foo function",
                8,
                11,
                "`",
                "code",
            );
            expect(result.newText).toBe("use the `foo` function");
            expect(result.newStart).toBe(8);
            expect(result.newEnd).toBe(13);
        });
    });

    describe("without selection (cursor in word)", () => {
        it("wraps the whole word when cursor is in the middle", () => {
            const result = applyInlineFormat("hello world", 3, 3, "**", "bold");
            expect(result.newText).toBe("**hello** world");
            expect(result.newStart).toBe(2);
            expect(result.newEnd).toBe(7);
        });

        it("wraps the word when cursor is at the start", () => {
            const result = applyInlineFormat(
                "hello world",
                0,
                0,
                "_",
                "italic",
            );
            expect(result.newText).toBe("_hello_ world");
            expect(result.newStart).toBe(1);
            expect(result.newEnd).toBe(6);
        });

        it("wraps the word when cursor is at the end", () => {
            const result = applyInlineFormat(
                "hello world",
                5,
                5,
                "~~",
                "strike",
            );
            expect(result.newText).toBe("~~hello~~ world");
            expect(result.newStart).toBe(2);
            expect(result.newEnd).toBe(7);
        });

        it("wraps punctuation-connected text as a word", () => {
            const result = applyInlineFormat(
                "call foo.bar() now",
                8,
                8,
                "`",
                "code",
            );
            expect(result.newText).toBe("call `foo.bar()` now");
        });

        it("wraps the word to the left when cursor is on whitespace between words", () => {
            const result = applyInlineFormat("hello world", 5, 5, "**", "bold");
            expect(result.newText).toBe("**hello** world");
            expect(result.newStart).toBe(2);
        });

        it("inserts placeholder in empty text", () => {
            const result = applyInlineFormat("", 0, 0, "`", "code");
            expect(result.newText).toBe("`code`");
        });
    });
});

describe("applyListFormat", () => {
    describe("toggle off - same prefix exists", () => {
        it("removes unordered list prefix", () => {
            const result = applyListFormat("- item", 3, 3, "- ");
            expect(result.newText).toBe("item");
            expect(result.newStart).toBe(1);
        });

        it("removes ordered list prefix", () => {
            const result = applyListFormat("1. item", 4, 4, "1. ");
            expect(result.newText).toBe("item");
            expect(result.newStart).toBe(1);
        });

        it("removes task list prefix", () => {
            const result = applyListFormat("- [ ] item", 7, 7, "- [ ] ");
            expect(result.newText).toBe("item");
            expect(result.newStart).toBe(1);
        });
    });

    describe("replace - different prefix exists", () => {
        it("replaces ordered list with unordered list", () => {
            const result = applyListFormat("1. item", 4, 4, "- ");
            expect(result.newText).toBe("- item");
            expect(result.newStart).toBe(3);
        });

        it("replaces unordered list with ordered list", () => {
            const result = applyListFormat("- item", 3, 3, "1. ");
            expect(result.newText).toBe("1. item");
            expect(result.newStart).toBe(4);
        });

        it("replaces task list with ordered list", () => {
            const result = applyListFormat("- [ ] item", 7, 7, "1. ");
            expect(result.newText).toBe("1. item");
            expect(result.newStart).toBe(4);
        });

        it("replaces ordered list with task list", () => {
            const result = applyListFormat("1. item", 4, 4, "- [ ] ");
            expect(result.newText).toBe("- [ ] item");
            expect(result.newStart).toBe(7);
        });
    });

    describe("add - no prefix exists", () => {
        it("adds unordered list prefix", () => {
            const result = applyListFormat("item", 1, 1, "- ");
            expect(result.newText).toBe("- item");
            expect(result.newStart).toBe(3);
        });

        it("adds ordered list prefix", () => {
            const result = applyListFormat("item", 1, 1, "1. ");
            expect(result.newText).toBe("1. item");
            expect(result.newStart).toBe(4);
        });

        it("adds task list prefix", () => {
            const result = applyListFormat("item", 1, 1, "- [ ] ");
            expect(result.newText).toBe("- [ ] item");
            expect(result.newStart).toBe(7);
        });
    });
});

describe("getLinePrefix", () => {
    it("returns unordered for dash prefix", () => {
        expect(getLinePrefix("- item")).toEqual({
            prefix: "- ",
            type: "unordered",
        });
    });

    it("returns unordered for asterisk prefix", () => {
        expect(getLinePrefix("* item")).toEqual({
            prefix: "* ",
            type: "unordered",
        });
    });

    it("returns unordered for plus prefix", () => {
        expect(getLinePrefix("+ item")).toEqual({
            prefix: "+ ",
            type: "unordered",
        });
    });

    it("returns task unchecked for - [ ] prefix", () => {
        expect(getLinePrefix("- [ ] task")).toEqual({
            prefix: "- [ ] ",
            type: "task",
            checked: false,
        });
    });

    it("returns task checked for - [x] prefix", () => {
        expect(getLinePrefix("- [x] done")).toEqual({
            prefix: "- [x] ",
            type: "task",
            checked: true,
        });
    });

    it("returns ordered for numbered prefix", () => {
        expect(getLinePrefix("1. item")).toEqual({
            prefix: "1. ",
            type: "ordered",
            number: 1,
        });
    });

    it("handles multi-digit ordered prefix", () => {
        expect(getLinePrefix("42. answer")).toEqual({
            prefix: "42. ",
            type: "ordered",
            number: 42,
        });
    });

    it("returns blockquote for > prefix", () => {
        expect(getLinePrefix("> quote")).toEqual({
            prefix: "> ",
            type: "blockquote",
        });
    });

    it("returns none for plain text", () => {
        expect(getLinePrefix("hello")).toEqual({
            prefix: "",
            type: "none",
        });
    });

    it("returns none for empty string", () => {
        expect(getLinePrefix("")).toEqual({ prefix: "", type: "none" });
    });
});

describe("getNextOrderedNumber", () => {
    it("returns 1 when no previous ordered item", () => {
        expect(getNextOrderedNumber("some text\n- item\n", 11)).toBe(1);
    });

    it("returns next number after previous ordered item", () => {
        expect(getNextOrderedNumber("1. first\n2. second\n", 17)).toBe(3);
    });

    it("returns 1 when no previous ordered item exists", () => {
        expect(getNextOrderedNumber("some text\n\n", 11)).toBe(1);
    });

    it("stops at non-empty non-ordered line", () => {
        expect(getNextOrderedNumber("1. first\nsome text\n", 20)).toBe(1);
    });

    it("continues from last ordered item before blank lines", () => {
        expect(getNextOrderedNumber("1. first\n2. second\n\n", 18)).toBe(3);
    });
});

describe("handleEnterKey", () => {
    it("continues unordered list", () => {
        const result = handleEnterKey("- hello", 7);
        expect(result).not.toBeNull();
        expect(result?.newText).toBe("- hello\n- ");
        expect(result?.newCursorPos).toBe(10);
    });

    it("ends list when item is empty", () => {
        const result = handleEnterKey("- ", 2);
        expect(result).not.toBeNull();
        expect(result?.newText).toBe("");
        expect(result?.newCursorPos).toBe(0);
    });

    it("ends list when item has only prefix", () => {
        const result = handleEnterKey("- \n- hello", 2);
        expect(result).not.toBeNull();
        expect(result?.newText).toBe("- hello");
        expect(result?.newCursorPos).toBe(0);
    });

    it("continues task list with unchecked item", () => {
        const result = handleEnterKey("- [x] done", 10);
        expect(result).not.toBeNull();
        expect(result?.newText).toBe("- [x] done\n- [ ] ");
        expect(result?.newCursorPos).toBe(17);
    });

    it("continues ordered list with incremented number", () => {
        const result = handleEnterKey("1. first\n2. second", 18);
        expect(result).not.toBeNull();
        expect(result?.newText).toBe("1. first\n2. second\n3. ");
        expect(result?.newCursorPos).toBe(22);
    });

    it("continues blockquote", () => {
        const result = handleEnterKey("> hello", 7);
        expect(result).not.toBeNull();
        expect(result?.newText).toBe("> hello\n> ");
        expect(result?.newCursorPos).toBe(10);
    });

    it("returns null for non-list text", () => {
        const result = handleEnterKey("hello world", 11);
        expect(result).toBeNull();
    });

    it("splits line at cursor position (mid-word)", () => {
        const result = handleEnterKey("- hello world", 4);
        expect(result).not.toBeNull();
        expect(result?.newText).toBe("- he\n- llo world");
        expect(result?.newCursorPos).toBe(7);
    });

    it("splits line at end, creating empty next item", () => {
        const result = handleEnterKey("- hello", 7);
        expect(result).not.toBeNull();
        expect(result?.newText).toBe("- hello\n- ");
        expect(result?.newCursorPos).toBe(10);
    });
});

describe("applyCodeBlockFormat", () => {
    describe("toggle off - inside a code block", () => {
        it("removes fences when cursor is inside the code block", () => {
            const text = "before\n```\ncode content\n```\nafter";
            const result = applyCodeBlockFormat(text, 14, 14);
            expect(result.newText).toBe("before\ncode content\nafter");
        });

        it("adjusts cursor correctly after removing fences", () => {
            const text = "before\n```\ncode\n```\nafter";
            const result = applyCodeBlockFormat(text, 15, 15);
            expect(result.newText).toBe("before\ncode\nafter");
        });
    });

    describe("toggle on - not in a code block", () => {
        it("wraps selected text with triple backticks", () => {
            const result = applyCodeBlockFormat("hello world", 6, 11);
            expect(result.newText).toBe("hello ```\nworld\n```");
        });

        it("inserts empty code block when no selection", () => {
            const result = applyCodeBlockFormat("hello", 3, 3);
            expect(result.newText).toBe("hel```\n\n```lo");
        });
    });
});
