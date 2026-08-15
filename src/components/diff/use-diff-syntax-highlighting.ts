"use client";

import hljs from "highlight.js";
import { useEffect } from "react";

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
        const lines =
            diffRef.current.querySelectorAll<HTMLElement>(".d2h-code-line-ctn");
        for (const element of lines) {
            const text = element.textContent;
            if (!text) continue;
            element.innerHTML = hljs.highlight(text, { language }).value;
        }
    }, [diffRef, language, enabled, rerenderKey]);
}
