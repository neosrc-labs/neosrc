import { useCallback, useState } from "react";

/** Copies `text` to the clipboard and reports `copied` until `resetDelayMs` elapses. */
export function useCopyToClipboard(text: string, resetDelayMs = 2000) {
    const [copied, setCopied] = useState(false);

    const copy = useCallback(async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), resetDelayMs);
    }, [text, resetDelayMs]);

    return { copied, copy };
}
