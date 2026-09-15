"use client";

import type { ReactNode } from "react";

/**
 * One labelled block of the branch list. Sections after the first carry their
 * own top spacing so the groups read as separate lists.
 */
export function BranchSection({
    title,
    className,
    children,
}: {
    title: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <section className={className}>
            <h2 className="border-border-subtle border-b bg-surface-elevated px-4 py-2 font-semibold text-sm text-text-primary">
                {title}
            </h2>
            {children}
        </section>
    );
}
