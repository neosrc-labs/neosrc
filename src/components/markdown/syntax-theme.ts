import type { CSSProperties } from "react";

/**
 * Syntax highlighting themes for react-syntax-highlighter, tuned to the app's
 * palette in `src/styles/globals.css`.
 *
 * Hue families are anchored to the app's semantic accents:
 *   - keywords  -> violet  (--color-state-merged)
 *   - strings   -> green   (--color-state-open)
 *   - numbers   -> amber   (--color-state-queued)
 *   - names     -> blue    (prose link color)
 *   - types     -> teal
 *   - deletions -> red     (--color-state-closed)
 *   - neutrals  -> zinc/gray text tokens (--color-text-*)
 *
 * Light mode uses the app's exact accent hexes (600/700 shades for contrast
 * on the #f3f4f6 code surface); dark mode uses the 400 shades of the same
 * hue families on the #27272a code surface. Comments use the app's muted
 * tier (deliberately lower contrast, like the UI's secondary text).
 *
 * The block background is intentionally absent here: the renderer owns it via
 * `customStyle` (--color-surface-tertiary).
 */

const darkNeutral = "#d4d4d8"; // --color-text-label
const lightNeutral = "#374151"; // --color-text-label

export const darkTheme: Record<string, CSSProperties> = {
    hljs: {
        display: "block",
        overflowX: "auto",
        color: "#f4f4f5", // --color-text-primary
    },
    "hljs-comment": { color: "#71717a", fontStyle: "italic" }, // --color-text-muted
    "hljs-quote": { color: "#71717a", fontStyle: "italic" },
    "hljs-doctag": { color: "#c084fc" }, // violet-400
    "hljs-keyword": { color: "#c084fc" },
    "hljs-formula": { color: "#c084fc" },
    "hljs-section": { color: "#60a5fa" }, // --tw-prose-links
    "hljs-name": { color: "#60a5fa" },
    "hljs-selector-tag": { color: "#60a5fa" },
    "hljs-deletion": { color: "#f87171" }, // red-400
    "hljs-subst": { color: darkNeutral },
    "hljs-literal": { color: "#fbbf24" }, // amber-400
    "hljs-string": { color: "#4ade80" }, // green-400
    "hljs-regexp": { color: "#4ade80" },
    "hljs-addition": { color: "#4ade80" },
    "hljs-attribute": { color: "#4ade80" },
    "hljs-meta-string": { color: "#4ade80" },
    "hljs-built_in": { color: "#2dd4bf" }, // teal-400
    "hljs-class .hljs-title": { color: "#2dd4bf" },
    "hljs-attr": { color: "#2dd4bf" },
    "hljs-variable": { color: darkNeutral },
    "hljs-template-variable": { color: darkNeutral },
    "hljs-type": { color: "#2dd4bf" },
    "hljs-selector-class": { color: "#60a5fa" },
    "hljs-selector-attr": { color: "#60a5fa" },
    "hljs-selector-pseudo": { color: "#60a5fa" },
    "hljs-number": { color: "#fbbf24" },
    "hljs-symbol": { color: "#fbbf24" },
    "hljs-bullet": { color: "#fbbf24" },
    "hljs-link": { color: "#60a5fa", textDecoration: "underline" },
    "hljs-meta": { color: "#a1a1aa" }, // --color-text-secondary
    "hljs-selector-id": { color: "#60a5fa" },
    "hljs-title": { color: "#60a5fa" },
    "hljs-emphasis": { fontStyle: "italic" },
    "hljs-strong": { fontWeight: "bold" },
    "hljs-params": { color: darkNeutral },
    "hljs-tag": { color: "#60a5fa" },
    "hljs-builtin-name": { color: "#2dd4bf" },
};

export const lightTheme: Record<string, CSSProperties> = {
    hljs: {
        display: "block",
        overflowX: "auto",
        color: "#111827", // --color-text-primary
    },
    "hljs-comment": { color: "#6b7280", fontStyle: "italic" }, // --color-text-tertiary
    "hljs-quote": { color: "#6b7280", fontStyle: "italic" },
    "hljs-doctag": { color: "#7c3aed" }, // --color-state-merged
    "hljs-keyword": { color: "#7c3aed" },
    "hljs-formula": { color: "#7c3aed" },
    "hljs-section": { color: "#2563eb" }, // blue-600, prose links
    "hljs-name": { color: "#2563eb" },
    "hljs-selector-tag": { color: "#2563eb" },
    "hljs-deletion": { color: "#dc2626" }, // --color-state-closed
    "hljs-subst": { color: lightNeutral },
    "hljs-literal": { color: "#a16207" }, // --color-state-queued
    "hljs-string": { color: "#15803d" }, // green-700 (--color-state-open family)
    "hljs-regexp": { color: "#15803d" },
    "hljs-addition": { color: "#16a34a" }, // --color-state-open
    "hljs-attribute": { color: "#15803d" },
    "hljs-meta-string": { color: "#15803d" },
    "hljs-built_in": { color: "#0f766e" }, // teal-700
    "hljs-class .hljs-title": { color: "#0f766e" },
    "hljs-attr": { color: "#0f766e" },
    "hljs-variable": { color: lightNeutral },
    "hljs-template-variable": { color: lightNeutral },
    "hljs-type": { color: "#0f766e" },
    "hljs-selector-class": { color: "#2563eb" },
    "hljs-selector-attr": { color: "#2563eb" },
    "hljs-selector-pseudo": { color: "#2563eb" },
    "hljs-number": { color: "#a16207" },
    "hljs-symbol": { color: "#a16207" },
    "hljs-bullet": { color: "#a16207" },
    "hljs-link": { color: "#2563eb", textDecoration: "underline" },
    "hljs-meta": { color: "#4b5563" }, // --color-text-secondary
    "hljs-selector-id": { color: "#2563eb" },
    "hljs-title": { color: "#2563eb" },
    "hljs-emphasis": { fontStyle: "italic" },
    "hljs-strong": { fontWeight: "bold" },
    "hljs-params": { color: lightNeutral },
    "hljs-tag": { color: "#2563eb" },
    "hljs-builtin-name": { color: "#0f766e" },
};
