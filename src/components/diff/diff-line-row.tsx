"use client";

import type { ReactNode } from "react";

export function DiffLineRow({
    id,
    className,
    children,
    onMouseLeave,
    dataOldLine,
    dataNewLine,
}: {
    id?: string;
    className?: string;
    children: ReactNode;
    onMouseLeave?: () => void;
    /** Line number of the old (left) side, when the row has one. */
    dataOldLine?: number;
    /** Line number of the new (right) side, when the row has one. */
    dataNewLine?: number;
}) {
    return (
        <tr
            className={className}
            data-new-line={dataNewLine}
            data-old-line={dataOldLine}
            id={id}
            onMouseLeave={onMouseLeave}
        >
            {children}
        </tr>
    );
}
