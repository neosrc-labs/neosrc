"use client";

import hljs from "highlight.js";
import { useEffect } from "react";

// Work budget per idle callback: highlight a few ms of lines, then yield so
// the browser can paint between chunks instead of one long blocking pass.
const CHUNK_BUDGET_MS = 8;

// Lines already processed carry this attribute; later passes (e.g. after a
// gap expansion or a view switch) skip them and only highlight newly
// rendered lines.
const HIGHLIGHTED_ATTR = "data-diff-highlighted";

function scheduleIdle(callback: () => void): () => void {
    if (typeof requestIdleCallback === "function") {
        const id = requestIdleCallback(callback, { timeout: 1_000 });
        return () => cancelIdleCallback(id);
    }
    // jsdom and older environments: run on the next macrotask instead.
    const id = setTimeout(callback, 0);
    return () => clearTimeout(id);
}

export function useDiffSyntaxHighlighting({
    diffRef,
    language,
    enabled,
    rerenderKey,
}: {
    diffRef: React.RefObject<HTMLDivElement | null>;
    language: string | null;
    enabled: boolean;
    rerenderKey: unknown;
}) {
    useEffect(() => {
        void rerenderKey;
        if (!diffRef.current || !language || !enabled) return;
        const lines = Array.from(
            diffRef.current.querySelectorAll<HTMLElement>(
                `.d2h-code-line-ctn:not([${HIGHLIGHTED_ATTR}])`,
            ),
        );
        if (lines.length === 0) return;

        let index = 0;
        let cancel: (() => void) | null = null;

        const runChunk = () => {
            const start = performance.now();
            while (index < lines.length) {
                const element = lines[index];
                if (element === undefined) break;
                index++;
                const text = element.textContent;
                if (text) {
                    element.innerHTML = hljs.highlight(text, {
                        language,
                    }).value;
                }
                element.setAttribute(HIGHLIGHTED_ATTR, "true");
                if (performance.now() - start >= CHUNK_BUDGET_MS) break;
            }
            if (index < lines.length) {
                cancel = scheduleIdle(runChunk);
            }
        };

        cancel = scheduleIdle(runChunk);

        return () => {
            cancel?.();
        };
    }, [diffRef, language, enabled, rerenderKey]);
}
