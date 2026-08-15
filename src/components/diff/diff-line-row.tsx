"use client";

import type { ReactNode } from "react";

export function DiffLineRow({
    id,
    className,
    children,
}: {
    id?: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <tr className={className} id={id}>
            {children}
        </tr>
    );
}
