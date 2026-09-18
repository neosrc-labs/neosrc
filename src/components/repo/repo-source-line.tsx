"use client";

import { useEffect, useState } from "react";
import { cn } from "~/utils/helpers";

export function useSourceLineSelection(
    fileKey: string,
    sourceLines: string[],
    ready = true,
) {
    const [selectedLine, setSelectedLine] = useState<number | null>(null);

    // biome-ignore lint/correctness/useExhaustiveDependencies: a different file must resync even when its content is identical
    useEffect(() => {
        if (!ready) {
            setSelectedLine(null);
            return;
        }

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
                document
                    .getElementById(`L${validLine}`)
                    ?.querySelector("a")
                    ?.scrollIntoView({
                        block: "center",
                        inline: "nearest",
                    });
            }
        }

        syncLineFromHash();
        window.addEventListener("hashchange", syncLineFromHash);
        return () => window.removeEventListener("hashchange", syncLineFromHash);
    }, [fileKey, sourceLines, ready]);

    function selectLine(line: number): void {
        const hash = `#L${line}`;
        if (window.location.hash !== hash) {
            window.history.pushState(null, "", hash);
        }
        setSelectedLine(line);
    }

    return { selectedLine, selectLine };
}

export function RepoSourceLine({
    lineNumber,
    sourceLine,
    html,
    gutterWidth,
    selected,
    onSelect,
}: {
    lineNumber: number;
    sourceLine: string | undefined;
    html: string | undefined;
    gutterWidth: string;
    selected: boolean;
    onSelect: (line: number) => void;
}) {
    return (
        <div
            id={`L${lineNumber}`}
            className={cn("flex", selected && "bg-[rgba(251,146,60,0.2)]")}
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
                    onSelect(lineNumber);
                }}
                aria-label={`Line ${lineNumber}`}
                aria-current={selected ? "location" : undefined}
                className={cn(
                    "block shrink-0 select-none border-border border-r px-3 text-right text-text-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    selected ? "bg-transparent" : "bg-surface-elevated",
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
}
