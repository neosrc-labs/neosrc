import { describe, expect, it, vi } from "vitest";

const { createHighlighter } = vi.hoisted(() => ({
    createHighlighter: vi.fn(),
}));

vi.mock("shiki", () => ({
    createHighlighter,
    bundledLanguages: { ts: {} },
    bundledLanguagesAlias: {},
}));

import { highlightLines } from "./highlight";

// One highlighter instance serves every request, so a throwing tokenizer is
// the failure the cache itself is responsible for not latching.
const codeToTokens = vi.fn();
const highlighter = { loadLanguage: async () => {}, codeToTokens };

describe("highlightLines cache", () => {
    it("degrades a failed highlight to plain text without latching it", async () => {
        createHighlighter.mockResolvedValue(highlighter);
        codeToTokens.mockImplementationOnce(() => {
            throw new Error("wasm blew up");
        });

        // The failure resolves to plain text instead of rejecting.
        await expect(highlightLines("x", "ts")).resolves.toBeNull();

        codeToTokens.mockReturnValueOnce({ tokens: [[{ content: "x" }]] });
        await expect(highlightLines("x", "ts")).resolves.toEqual([
            '<span class="shiki-token">x</span>',
        ]);
        expect(codeToTokens).toHaveBeenCalledTimes(2);
    });
});
