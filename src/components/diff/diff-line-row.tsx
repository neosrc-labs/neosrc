"use client";

import type { ReactNode } from "react";

export function DiffLineRow({
    id,
    className,
    children,
    onMouseLeave,
}: {
    id?: string;
    className?: string;
    children: ReactNode;
    onMouseLeave?: () => void;
}) {
    return (
        <tr className={className} id={id} onMouseLeave={onMouseLeave}>
            {children}
        </tr>
    );
}
