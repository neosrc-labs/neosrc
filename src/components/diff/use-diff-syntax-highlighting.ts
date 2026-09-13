"use client";

import { useEffect } from "react";
import { highlightLines } from "~/utils/highlight";
import { scheduleIdle } from "~/utils/schedule-idle";

// Work budget per idle callback: highlight a few runs of lines, then yield so
// the browser can paint between chunks instead of one long blocking pass.
const CHUNK_BUDGET_MS = 8;

// Tokenizing a run is a single call, so a run is capped to keep one idle slice
// bounded (a large added file would otherwise block for hundreds of ms). A
// multi-line construct spanning the seam loses its state for the lines after
// it; that is rare, and unbounded runs are rarer still.
export const MAX_RUN_LINES = 200;

// Lines already processed carry this attribute; later passes (e.g. after a
// gap expansion or a view switch) skip them and only highlight newly
// rendered lines.
const HIGHLIGHTED_ATTR = "data-diff-highlighted";

const LINE_SELECTOR = ".d2h-code-line-ctn";

interface RunEntry {
    /** Cell to write the highlighted HTML into. Null for a mirror entry that
     * only exists to carry the other side's text through the run. */
    target: HTMLElement | null;
    /** Cell holding the line's source text. */
    source: HTMLElement;
    /** File line number, NaN when the row carries no numbering. */
    number: number;
}

function groupRuns(entries: RunEntry[]): RunEntry[][] {
    const runs: RunEntry[][] = [];
    let current: RunEntry[] = [];
    for (const entry of entries) {
        const previous = current[current.length - 1];
        if (
            previous &&
            entry.number === previous.number + 1 &&
            current.length < MAX_RUN_LINES
        ) {
            current.push(entry);
        } else {
            if (current.length > 0) runs.push(current);
            current = [entry];
        }
    }
    if (current.length > 0) runs.push(current);
    return runs;
}

/**
 * Groups rendered lines into runs of consecutive file lines, per side. A run
 * is tokenized in one call so multi-line constructs - block comments,
 * template literals - keep their state across lines.
 */
function collectRuns(root: HTMLElement): RunEntry[][] {
    const split = root.querySelector(".d2h-split-table") != null;
    const left: RunEntry[] = [];
    const right: RunEntry[] = [];
    const isolated: RunEntry[][] = [];

    for (const element of root.querySelectorAll<HTMLElement>(LINE_SELECTOR)) {
        const side = element.dataset.lineSide;
        const number = element.dataset.lineNumber
            ? Number(element.dataset.lineNumber)
            : Number.NaN;
        if (!Number.isFinite(number) || (side !== "LEFT" && side !== "RIGHT")) {
            isolated.push([{ target: element, source: element, number }]);
            continue;
        }
        (side === "LEFT" ? left : right).push({
            target: element,
            source: element,
            number,
        });
        // Unified view gives a context line a single cell, highlighted as the
        // new side. The old side still needs that text so a block comment
        // opened above keeps its state for the deletions that follow.
        if (!split && side === "RIGHT") {
            const oldLine = element
                .closest("tr")
                ?.getAttribute("data-old-line");
            if (oldLine) {
                left.push({
                    target: null,
                    source: element,
                    number: Number(oldLine),
                });
            }
        }
    }

    return [...groupRuns(left), ...groupRuns(right), ...isolated];
}

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
    /** Fence tag or file extension to highlight with. */
    language: string | null;
    enabled: boolean;
}) {
    useEffect(() => {
        const root = diffRef.current;
        if (!root || !language || !enabled) return;

        let cancel: (() => void) | null = null;
        let disposed = false;

        const schedule = () => {
            if (cancel || disposed) return;
            cancel = scheduleIdle(() => {
                cancel = null;
                void runChunk();
            });
        };

        const runChunk = async () => {
            if (disposed) return;
            // Nothing new to do: skip walking the (possibly large) table.
            if (
                !root.querySelector(
                    `${LINE_SELECTOR}:not([${HIGHLIGHTED_ATTR}])`,
                )
            ) {
                return;
            }
            const start = performance.now();
            for (const run of collectRuns(root)) {
                if (disposed) return;
                const pending = run.some(
                    (entry) =>
                        entry.target !== null &&
                        !entry.target.hasAttribute(HIGHLIGHTED_ATTR),
                );
                if (!pending) continue;

                const text = run
                    .map((entry) => entry.source.textContent ?? "")
                    .join("\n");
                const lines = text
                    ? await highlightLines(text, language)
                    : [""];
                if (disposed) return;
                // React reuses a cell when its row content changes. If that
                // happened while the tokens were being computed, writing them
                // now would mark the new content as done with stale markup.
                if (
                    run
                        .map((entry) => entry.source.textContent ?? "")
                        .join("\n") !== text
                ) {
                    schedule();
                    return;
                }
                run.forEach((entry, index) => {
                    if (!entry.target) return;
                    // An unsupported language leaves the plain text alone.
                    if (lines) entry.target.innerHTML = lines[index] ?? "";
                    entry.target.setAttribute(HIGHLIGHTED_ATTR, "true");
                });

                if (performance.now() - start >= CHUNK_BUDGET_MS) {
                    schedule();
                    return;
                }
            }
        };

        schedule();

        // Highlighting rewrites the line's own children, which fires this
        // observer again; the next pass then finds nothing left to do.
        const observer = new MutationObserver(schedule);
        observer.observe(root, { childList: true, subtree: true });

        return () => {
            disposed = true;
            observer.disconnect();
            cancel?.();
        };
    }, [diffRef, language, enabled]);
}
