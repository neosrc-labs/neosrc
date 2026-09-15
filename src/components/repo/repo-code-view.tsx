"use client";

import { useEffect, useMemo, useState } from "react";
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
    const highlighted = useMemo(() => lines?.join("\n") ?? null, [lines]);

    const lineNumbers = useMemo(
        () => content.split("\n").map((_, index) => index + 1),
        [content],
    );

    return (
        <div className="flex overflow-x-auto font-mono text-xs leading-5">
            <div
                aria-hidden
                className="shrink-0 select-none border-border border-r bg-surface-elevated px-3 py-2 text-right text-text-muted"
            >
                {lineNumbers.map((line) => (
                    <div key={line}>{line}</div>
                ))}
            </div>
            {highlighted === null ? (
                <code className="min-w-0 flex-1 whitespace-pre px-3 py-2">
                    {content}
                </code>
            ) : (
                <code
                    className="min-w-0 flex-1 whitespace-pre px-3 py-2"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki escapes the source before emitting token markup
                    dangerouslySetInnerHTML={{ __html: highlighted }}
                />
            )}
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
