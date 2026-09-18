"use client";

import { useEffect, useMemo, useState } from "react";
import { highlightLines } from "~/utils/highlight";
import { RepoSourceLine, useSourceLineSelection } from "./repo-source-line";

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
    const { selectedLine, selectLine } = useSourceLineSelection(
        name,
        sourceLines,
    );

    return (
        <div className="overflow-x-auto font-mono text-xs leading-5">
            <div className="w-max min-w-full pb-2">
                {sourceLines.map((sourceLine, index) => {
                    const lineNumber = index + 1;
                    return (
                        <RepoSourceLine
                            key={lineNumber}
                            lineNumber={lineNumber}
                            sourceLine={sourceLine}
                            html={lines?.[index]}
                            gutterWidth={gutterWidth}
                            selected={selectedLine === lineNumber}
                            onSelect={selectLine}
                        />
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
