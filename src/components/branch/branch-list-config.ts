import type { BranchTab } from "~/server/api/routers/branches/types";
import type { Provider } from "~/utils/provider-url";

export const BRANCH_TABS: readonly { key: BranchTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "active", label: "Active" },
    { key: "stale", label: "Stale" },
    { key: "all", label: "All" },
];

export interface BranchListConfig {
    provider: Provider;
    /** Provider page describing the rules protecting a branch. */
    rulesUrl: (owner: string, repo: string, branch: string) => string;
    rulesLabel: string;
    /** Whether the rules entry is useful to viewers without admin rights. */
    rulesForEveryone: boolean;
}

export const ghBranchConfig: BranchListConfig = {
    provider: "gh",
    rulesUrl: (owner, repo, branch) =>
        `https://github.com/${owner}/${repo}/rules?ref=${encodeURIComponent(`refs/heads/${branch}`)}`,
    rulesLabel: "View rules",
    rulesForEveryone: true,
};

export const cbBranchConfig: BranchListConfig = {
    provider: "cb",
    rulesUrl: (owner, repo) =>
        `https://codeberg.org/${owner}/${repo}/settings/branches`,
    rulesLabel: "Branch protection settings",
    rulesForEveryone: false,
};
