"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "~/utils/helpers";
import { highlightLines } from "~/utils/highlight";

/** Lowercased extension used as a highlight grammar tag; "" when there is none. */
function fileExtension(name: string): string {
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/**
 * Per-line highlighted HTML for `name` + `content`, or null until it resolves
 * and when shiki has no grammar for the file's extension.
 */
export function useHighlightedLines(
    name: string,
    content: string,
): string[] | null {
    const [lines, setLines] = useState<string[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLines(null);
        highlightLines(content, fileExtension(name)).then((result) => {
            if (!cancelled) setLines(result);
        });
        return () => {
            cancelled = true;
        };
    }, [content, name]);

    return lines;
}

/**
 * Line-numbered file body. Highlighting runs in the browser so the grammar
 * chunk is not part of the page bundle; until it resolves the file shows as
 * plain text.
 */
export function CodeView({ name, content }: { name: string; content: string }) {
    const lines = useHighlightedLines(name, content);
    const sourceLines = useMemo(() => content.split("\n"), [content]);
    const gutterWidth = `calc(${String(sourceLines.length).length}ch + 1.5rem + 1px)`;
    const [selectedLine, setSelectedLine] = useState<number | null>(null);

    // biome-ignore lint/correctness/useExhaustiveDependencies: a different file must resync even when its content is identical
    useEffect(() => {
        function syncLineFromHash(): void {
            const match = /^#L([1-9]\d*)$/.exec(window.location.hash);
            const line = match ? Number(match[1]) : null;
            const validLine =
                line !== null &&
                Number.isSafeInteger(line) &&
                line <= sourceLines.length
                    ? line
                    : null;
            setSelectedLine(validLine);
            if (validLine !== null) {
                document.getElementById(`L${validLine}`)?.scrollIntoView({
                    block: "center",
                    inline: "nearest",
                });
            }
        }

        syncLineFromHash();
        window.addEventListener("hashchange", syncLineFromHash);
        return () => window.removeEventListener("hashchange", syncLineFromHash);
    }, [name, sourceLines]);

    return (
        <div className="overflow-x-auto font-mono text-xs leading-5">
            <div className="w-max min-w-full pb-2">
                {sourceLines.map((sourceLine, index) => {
                    const lineNumber = index + 1;
                    const html = lines?.[index];
                    const selected = selectedLine === lineNumber;
                    return (
                        <div
                            key={lineNumber}
                            id={`L${lineNumber}`}
                            className={cn(
                                "flex",
                                selected && "bg-[rgba(251,146,60,0.2)]",
                            )}
                        >
                            <a
                                href={`#L${lineNumber}`}
                                onClick={(event) => {
                                    if (
                                        event.button !== 0 ||
                                        event.metaKey ||
                                        event.ctrlKey ||
                                        event.shiftKey ||
                                        event.altKey
                                    ) {
                                        return;
                                    }
                                    event.preventDefault();
                                    const hash = `#L${lineNumber}`;
                                    if (window.location.hash !== hash) {
                                        window.history.pushState(
                                            null,
                                            "",
                                            hash,
                                        );
                                    }
                                    setSelectedLine(lineNumber);
                                }}
                                aria-label={`Line ${lineNumber}`}
                                aria-current={selected ? "location" : undefined}
                                className={cn(
                                    "block shrink-0 select-none border-border border-r px-3 text-right text-text-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                                    selected
                                        ? "bg-transparent"
                                        : "bg-surface-elevated",
                                )}
                                style={{ width: gutterWidth }}
                            >
                                {lineNumber}
                            </a>
                            {html === undefined ? (
                                <code className="block min-h-5 flex-1 whitespace-pre px-3">
                                    {sourceLine}
                                </code>
                            ) : (
                                <code
                                    className="block min-h-5 flex-1 whitespace-pre px-3"
                                    // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki escapes the source before emitting token markup
                                    dangerouslySetInnerHTML={{ __html: html }}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/** Loading state of a file body; also used by the blame view. */
export function FileBodySkeleton() {
    return (
        <div className="space-y-2 p-6">
            {["l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8"].map(
                (key, index) => (
                    <div
                        key={key}
                        className="h-5 animate-pulse rounded bg-surface-secondary"
                        style={{ width: `${40 + ((index * 13) % 50)}%` }}
                    />
                ),
            )}
        </div>
    );
}
