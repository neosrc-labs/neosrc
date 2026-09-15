"use client";

import type { ReactNode } from "react";

/**
 * The five columns every branch table shares, plus the header geometry. The
 * skeleton renders the same shell and the loaded rows are single-line, so a
 * row is always 40px and the two states cannot disagree.
 */
export function BranchTableShell({ children }: { children: ReactNode }) {
    return (
        <table className="w-full table-fixed">
            <thead>
                <tr className="border-border border-b bg-surface-elevated text-text-tertiary text-xs">
                    <th className="w-[40%] px-4 py-2 text-left font-medium">
                        Branch
                    </th>
                    <th className="w-[22%] px-4 py-2 text-left font-medium">
                        Updated
                    </th>
                    <th className="w-[16%] px-4 py-2 text-left font-medium">
                        Check status
                    </th>
                    <th className="w-[15%] px-4 py-2 text-left font-medium">
                        Pull request
                    </th>
                    <th className="w-[7%] px-4 py-2 text-right font-medium">
                        <span className="sr-only">Action menu</span>
                    </th>
                </tr>
            </thead>
            <tbody>{children}</tbody>
        </table>
    );
}
