"use client";

import type { ReactNode } from "react";

/** A standalone group in the branch overview. */
export function BranchSection({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <section className="overflow-hidden rounded-md border border-border-subtle">
            <h2 className="border-border-subtle border-b bg-surface-elevated px-4 py-2 font-semibold text-sm text-text-primary">
                {title}
            </h2>
            {children}
        </section>
    );
}
