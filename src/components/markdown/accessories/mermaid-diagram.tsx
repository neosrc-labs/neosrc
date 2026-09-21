"use client";

import { useTheme } from "next-themes";
import { useEffect, useId, useState } from "react";

type RenderState = {
    code: string;
    svg: string | null;
    error: string | null;
};

/**
 * Renders a fenced ```mermaid code block as an SVG diagram. Falls back to
 * the raw source when the diagram fails to parse.
 */
export function MermaidDiagram({ code }: { code: string }) {
    const { resolvedTheme } = useTheme();
    const id = useId();
    const [state, setState] = useState<RenderState>({
        code,
        svg: null,
        error: null,
    });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            // Dynamic import: mermaid is ~1MB and must stay out of the main
            // markdown bundle. It only loads when a mermaid block appears.
            const mermaid = (await import("mermaid")).default;
            if (cancelled) return;
            mermaid.initialize({
                startOnLoad: false,
                securityLevel: "strict",
                theme: resolvedTheme === "dark" ? "dark" : "default",
            });
            try {
                const { svg } = await mermaid.render(
                    `mermaid-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`,
                    code,
                );
                if (!cancelled) setState({ code, svg, error: null });
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : "Invalid diagram";
                if (!cancelled) setState({ code, svg: null, error: message });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [code, id, resolvedTheme]);

    if (state.code !== code) {
        // New diagram requested, render pending.
        return null;
    }

    if (state.svg == null) {
        if (state.error != null) {
            return (
                <div className="overflow-x-auto rounded-lg border border-danger p-4 text-danger text-sm">
                    <p className="mb-2 font-semibold">
                        Mermaid diagram failed to render
                    </p>
                    <pre className="whitespace-pre-wrap">{code}</pre>
                </div>
            );
        }
        return null;
    }

    return (
        <div
            className="my-4 flex justify-center overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid output for the parsed diagram, sanitized with securityLevel strict
            dangerouslySetInnerHTML={{ __html: state.svg }}
        />
    );
}
