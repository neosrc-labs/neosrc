import { describe, expect, it } from "vitest";
import { CODE_LANGUAGE_TAGS } from "../code-language-map";

describe("CODE_LANGUAGE_TAGS", () => {
    it("resolves canonical language ids to themselves", () => {
        for (const id of [
            "rust",
            "go",
            "xml",
            "shell",
            "bash",
            "javascript",
            "typescript",
            "python",
            "cpp",
            "csharp",
            "kotlin",
            "swift",
            "yaml",
            "makefile",
            "plaintext",
        ]) {
            expect(CODE_LANGUAGE_TAGS[id]).toBe(id);
        }
    });

    it("resolves common alias tags to their canonical id", () => {
        expect(CODE_LANGUAGE_TAGS.js).toBe("javascript");
        expect(CODE_LANGUAGE_TAGS.ts).toBe("typescript");
        expect(CODE_LANGUAGE_TAGS.tsx).toBe("typescript");
        expect(CODE_LANGUAGE_TAGS.jsx).toBe("javascript");
        expect(CODE_LANGUAGE_TAGS.py).toBe("python");
        expect(CODE_LANGUAGE_TAGS.sh).toBe("bash");
        expect(CODE_LANGUAGE_TAGS.zsh).toBe("bash");
        expect(CODE_LANGUAGE_TAGS.rs).toBe("rust");
        expect(CODE_LANGUAGE_TAGS.html).toBe("xml");
        expect(CODE_LANGUAGE_TAGS.yml).toBe("yaml");
        expect(CODE_LANGUAGE_TAGS.md).toBe("markdown");
        expect(CODE_LANGUAGE_TAGS.tex).toBe("latex");
        expect(CODE_LANGUAGE_TAGS.docker).toBe("dockerfile");
        expect(CODE_LANGUAGE_TAGS.console).toBe("shell");
        expect(CODE_LANGUAGE_TAGS.txt).toBe("plaintext");
        expect(CODE_LANGUAGE_TAGS.pycon).toBe("python-repl");
    });

    it("prefers canonical ids over aliases", () => {
        // "shell" and "htmlbars" are both canonical ids and aliases of other
        // grammars; the canonical id must win.
        expect(CODE_LANGUAGE_TAGS.shell).toBe("shell");
        expect(CODE_LANGUAGE_TAGS.htmlbars).toBe("htmlbars");
    });

    it("resolves alias collisions like highlight.js (last-registered wins)", () => {
        // lasso and livescript both alias "ls"; highlight.js resolves to
        // livescript, matching GitHub's linguist mapping.
        expect(CODE_LANGUAGE_TAGS.ls).toBe("livescript");
        // handlebars and htmlbars both alias "hbs"; htmlbars registers last.
        expect(CODE_LANGUAGE_TAGS.hbs).toBe("htmlbars");
    });

    it("returns undefined for unknown tags", () => {
        expect(CODE_LANGUAGE_TAGS.definitelynotalanguage).toBeUndefined();
        // Languages highlight.js v10.7.3 has no grammar for — the renderer
        // falls back to auto-detection for these.
        expect(CODE_LANGUAGE_TAGS.graphql).toBeUndefined();
        expect(CODE_LANGUAGE_TAGS.zig).toBeUndefined();
    });

    it("maps every value back to a canonical self-entry", () => {
        for (const [tag, id] of Object.entries(CODE_LANGUAGE_TAGS)) {
            expect(
                CODE_LANGUAGE_TAGS[id],
                `missing canonical entry for ${tag}`,
            ).toBe(id);
        }
    });
});
