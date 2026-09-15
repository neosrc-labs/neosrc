"use client";

import type { BranchRow } from "~/server/api/routers/branches/types";
import type { BranchListConfig } from "./branch-list-config";
import { BranchTableRow } from "./branch-row";

/** Branch list table: one row per branch with its checks and actions. */
export function BranchTable({
    owner,
    repo,
    rows,
    canManage,
    isAdmin,
    defaultBranch,
    config,
}: {
    owner: string;
    repo: string;
    rows: BranchRow[];
    canManage: boolean;
    isAdmin: boolean;
    defaultBranch: string | null;
    config: BranchListConfig;
}) {
    const { provider } = config;

    return (
        <table className="w-full">
            <thead>
                <tr className="border-border border-b bg-surface-elevated text-text-tertiary text-xs">
                    <th className="px-4 py-2 text-left font-medium">Branch</th>
                    <th className="px-4 py-2 text-left font-medium">Updated</th>
                    <th className="px-4 py-2 text-left font-medium">
                        Check status
                    </th>
                    <th className="px-4 py-2 text-left font-medium">
                        Pull request
                    </th>
                    <th className="px-4 py-2 text-right font-medium">
                        <span className="sr-only">Action menu</span>
                    </th>
                </tr>
            </thead>
            <tbody>
                {rows.map((branch) => (
                    <BranchTableRow
                        key={branch.name}
                        provider={provider}
                        owner={owner}
                        repo={repo}
                        branch={branch}
                        canManage={canManage}
                        isAdmin={isAdmin}
                        defaultBranch={defaultBranch}
                        config={config}
                    />
                ))}
            </tbody>
        </table>
    );
}
