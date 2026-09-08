"use client";

import hljs from "highlight.js";
import { useEffect } from "react";
import { scheduleIdle } from "~/utils/schedule-idle";

// Work budget per idle callback: highlight a few ms of lines, then yield so
// the browser can paint between chunks instead of one long blocking pass.
const CHUNK_BUDGET_MS = 8;

// Lines already processed carry this attribute; later passes (e.g. after a
// gap expansion or a view switch) skip them and only highlight newly
// rendered lines.
const HIGHLIGHTED_ATTR = "data-diff-highlighted";

const UNHIGHLIGHTED_SELECTOR = `.d2h-code-line-ctn:not([${HIGHLIGHTED_ATTR}])`;

/**
 * Highlights diff lines in idle chunks. Rows can appear long after the first
 * pass (expanded context arrives with the file fetch, threads mount, the view
 * switches), so insertions are observed instead of relying on a render key.
 */
export function useDiffSyntaxHighlighting({
    diffRef,
    language,
    enabled,
}: {
    diffRef: React.RefObject<HTMLDivElement | null>;
    language: string | null;
    enabled: boolean;
}) {
    useEffect(() => {
        const root = diffRef.current;
        if (!root || !language || !enabled) return;

        let cancel: (() => void) | null = null;

        const schedule = () => {
            if (cancel) return;
            cancel = scheduleIdle(runChunk);
        };

        const runChunk = () => {
            cancel = null;
            const lines = Array.from(
                root.querySelectorAll<HTMLElement>(UNHIGHLIGHTED_SELECTOR),
            );
            const start = performance.now();
            let processed = 0;
            for (const element of lines) {
                const text = element.textContent;
                if (text) {
                    element.innerHTML = hljs.highlight(text, {
                        language,
                    }).value;
                }
                element.setAttribute(HIGHLIGHTED_ATTR, "true");
                processed++;
                if (performance.now() - start >= CHUNK_BUDGET_MS) break;
            }
            if (processed < lines.length) schedule();
        };

        schedule();

        // Highlighting rewrites the line's own children, which fires this
        // observer again; the next pass then finds nothing left to do.
        const observer = new MutationObserver(schedule);
        observer.observe(root, { childList: true, subtree: true });

        return () => {
            observer.disconnect();
            cancel?.();
        };
    }, [diffRef, language, enabled]);
}
