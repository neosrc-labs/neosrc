import type { BundledLanguage, Highlighter } from "shiki";

/** GitHub's own light and dark themes, applied together as CSS variables. */
export const HIGHLIGHT_THEMES = {
    light: "github-light",
    dark: "github-dark",
} as const;

// Extensions neither a shiki language id nor one of its aliases.
const LANGUAGE_ALIASES: Record<string, string> = {
    cr: "crystal",
    ex: "elixir",
    exs: "elixir",
    h: "c",
    hpp: "cpp",
    patch: "diff",
    pl: "perl",
    sol: "solidity",
};

type ShikiModule = typeof import("shiki");
type LanguageInput = Parameters<Highlighter["loadLanguage"]>[0];

let shikiPromise: Promise<ShikiModule> | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;
const languageLoads = new Map<string, Promise<boolean>>();

function loadShiki(): Promise<ShikiModule> {
    shikiPromise ??= import("shiki");
    return shikiPromise;
}

function loadHighlighter(): Promise<Highlighter> {
    highlighterPromise ??= loadShiki().then(({ createHighlighter }) =>
        createHighlighter({
            themes: [HIGHLIGHT_THEMES.light, HIGHLIGHT_THEMES.dark],
            langs: [],
        }),
    );
    return highlighterPromise;
}

/**
 * Loads the grammar for a language id, alias, or file extension. A grammar is
 * fetched once; tags shiki has no grammar for resolve to false and stay plain.
 */
function ensureLanguage(
    highlighter: Highlighter,
    language: string,
): Promise<boolean> {
    let load = languageLoads.get(language);
    if (!load) {
        load = loadShiki().then(
            ({ bundledLanguages, bundledLanguagesAlias }) => {
                const grammars = bundledLanguages as Record<
                    string,
                    LanguageInput
                >;
                const aliases = bundledLanguagesAlias as Record<
                    string,
                    LanguageInput
                >;
                const grammar = grammars[language] ?? aliases[language];
                if (!grammar) return false;
                // A grammar that fails to fetch leaves the code plain instead
                // of taking the surrounding view down with it.
                return highlighter.loadLanguage(grammar).then(
                    () => true,
                    () => false,
                );
            },
        );
        languageLoads.set(language, load);
    }
    return load;
}

function escapeHtml(text: string): string {
    return text.replace(/[&<>]/g, (char) => {
        if (char === "&") return "&amp;";
        if (char === "<") return "&lt;";
        return "&gt;";
    });
}

function renderToken(token: {
    content: string;
    htmlStyle?: Record<string, string>;
}): string {
    const style = token.htmlStyle
        ? Object.entries(token.htmlStyle)
              .map(([name, value]) => `${name}:${value}`)
              .join(";")
        : "";
    const styleAttribute = style ? ` style="${style}"` : "";
    return `<span class="shiki-token"${styleAttribute}>${escapeHtml(token.content)}</span>`;
}

/**
 * Highlights `code` and returns one HTML string per source line. Tokenizing
 * the whole text in one pass is what keeps multi-line constructs (block
 * comments, template literals) intact. Every token carries both themes'
 * colours as CSS variables, so the active theme is chosen in CSS and a theme
 * switch never re-highlights. Resolves to null when the tag has no grammar;
 * rejects when the highlighter or a chunk cannot be loaded.
 */
async function highlightUncached(
    code: string,
    tag: string,
): Promise<string[] | null> {
    const language = LANGUAGE_ALIASES[tag] ?? tag;
    const highlighter = await loadHighlighter();
    if (!(await ensureLanguage(highlighter, language))) return null;
    const { tokens } = highlighter.codeToTokens(code, {
        lang: language as BundledLanguage,
        themes: {
            light: HIGHLIGHT_THEMES.light,
            dark: HIGHLIGHT_THEMES.dark,
        },
        defaultColor: false,
    });
    return tokens.map((line) => line.map(renderToken).join(""));
}

// Re-highlighting the same file is common (tab toggles, ref switches), and the
// result is pure for a given (code, tag).
const HIGHLIGHT_CACHE_LIMIT = 8;
const highlightCache = new Map<string, string[] | null>();

/**
 * Cached {@link highlightUncached}. Only resolved results are stored, so a
 * failed highlight degrades this render to plain text instead of latching
 * null into the cache.
 */
export function highlightLines(
    code: string,
    tag: string,
): Promise<string[] | null> {
    const key = `${tag}\u0000${code}`;
    if (highlightCache.has(key)) {
        return Promise.resolve(highlightCache.get(key) ?? null);
    }

    return highlightUncached(code, tag).then(
        (result) => {
            highlightCache.set(key, result);
            while (highlightCache.size > HIGHLIGHT_CACHE_LIMIT) {
                const oldest = highlightCache.keys().next().value;
                if (oldest === undefined) break;
                highlightCache.delete(oldest);
            }
            return result;
        },
        () => null,
    );
}
