"use client";

import type { BranchRow } from "~/server/api/routers/branches/types";
import type { BranchListConfig } from "./branch-list-config";
import { BranchTableRow } from "./branch-row";
import { BranchTableShell } from "./branch-table-shell";

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
        <BranchTableShell>
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
        </BranchTableShell>
    );
}
