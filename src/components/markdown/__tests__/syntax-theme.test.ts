import { describe, expect, it } from "vitest";
import { darkTheme, lightTheme } from "../syntax-theme";

const REQUIRED_KEYS = [
    "hljs",
    "hljs-keyword",
    "hljs-string",
    "hljs-comment",
    "hljs-number",
    "hljs-title",
    "hljs-type",
    "hljs-built_in",
    "hljs-variable",
    "hljs-deletion",
    "hljs-addition",
    "hljs-meta",
    "hljs-params",
    "hljs-emphasis",
    "hljs-strong",
];

describe("syntax themes", () => {
    it("defines the base style and all required token classes in both modes", () => {
        for (const theme of [lightTheme, darkTheme]) {
            for (const key of REQUIRED_KEYS) {
                expect(theme[key], `missing ${key}`).toBeDefined();
            }
            expect(theme.hljs?.color).toBeDefined();
        }
    });

    it("covers the same token classes in light and dark", () => {
        expect(Object.keys(lightTheme).sort()).toEqual(
            Object.keys(darkTheme).sort(),
        );
    });

    it("gives every token class at least one style", () => {
        for (const theme of [lightTheme, darkTheme]) {
            for (const [key, style] of Object.entries(theme)) {
                expect(
                    Object.keys(style).length,
                    `${key} has no styles`,
                ).toBeGreaterThan(0);
            }
        }
    });

    it("anchors keyword and deletion hues to the app's accent tokens", () => {
        // --color-state-merged (violet-600) and --color-state-closed (red-600)
        expect(lightTheme["hljs-keyword"]?.color).toBe("#7c3aed");
        expect(lightTheme["hljs-deletion"]?.color).toBe("#dc2626");
        // dark: violet-400 / red-400 of the same hue families
        expect(darkTheme["hljs-keyword"]?.color).toBe("#c084fc");
        expect(darkTheme["hljs-deletion"]?.color).toBe("#f87171");
    });

    it("uses the app's muted gray for comments in both modes", () => {
        expect(darkTheme["hljs-comment"]?.color).toBe("#71717a"); // --color-text-muted
        expect(lightTheme["hljs-comment"]?.color).toBe("#6b7280"); // --color-text-tertiary
    });

    it("styles emphasis and strong without colors", () => {
        expect(darkTheme["hljs-emphasis"]).toEqual({ fontStyle: "italic" });
        expect(darkTheme["hljs-strong"]).toEqual({ fontWeight: "bold" });
        expect(lightTheme["hljs-emphasis"]).toEqual({ fontStyle: "italic" });
        expect(lightTheme["hljs-strong"]).toEqual({ fontWeight: "bold" });
    });
});
