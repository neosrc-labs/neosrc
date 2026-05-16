"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

const DARK_HIGHLIGHT_HREF =
    "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css";

export function ThemeStylesheets() {
    const { resolvedTheme } = useTheme();
    const linkRef = useRef<HTMLLinkElement | null>(null);

    useEffect(() => {
        if (resolvedTheme === "dark" && !linkRef.current) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.id = "highlight-dark-theme";
            link.href = DARK_HIGHLIGHT_HREF;
            document.head.appendChild(link);
            linkRef.current = link;
        }

        if (resolvedTheme !== "dark" && linkRef.current) {
            linkRef.current.remove();
            linkRef.current = null;
        }

        return () => {
            if (linkRef.current) {
                linkRef.current.remove();
                linkRef.current = null;
            }
        };
    }, [resolvedTheme]);

    return null;
}
