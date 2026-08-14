"use client";

import type { ReactNode } from "react";
import { useCopyToClipboard } from "~/hooks/use-copy-to-clipboard";

/** Button that copies `text` on click; `children` renders the label from the copied state. */
export function CopyButton({
    text,
    className,
    children,
}: {
    text: string;
    className?: string;
    children: (copied: boolean) => ReactNode;
}) {
    const { copied, copy } = useCopyToClipboard(text);

    return (
        <button
            type="button"
            onClick={() => {
                void copy();
            }}
            className={className}
        >
            {children(copied)}
        </button>
    );
}
