import type { RepositoryInfo } from "~/server/api/routers/repos";
import type { MergeMethod } from "~/server/github";

interface MergeOptionDef {
    value: MergeMethod;
    label: string;
    description: string;
    /** RepositoryInfo flag that disables the method when explicitly false. */
    setting: "allowMergeCommit" | "allowSquashMerge" | "allowRebaseMerge";
}

/** The merge methods neosrc offers, in display order. */
export const MERGE_OPTION_DEFS: readonly MergeOptionDef[] = [
    {
        value: "merge",
        label: "Create a merge commit",
        description:
            "All commits will be added to the base branch via a merge commit.",
        setting: "allowMergeCommit",
    },
    {
        value: "squash",
        label: "Squash and merge",
        description: "All commits will be squashed into a single commit.",
        setting: "allowSquashMerge",
    },
    {
        value: "rebase",
        label: "Rebase and merge",
        description:
            "All commits will be added to the base branch individually.",
        setting: "allowRebaseMerge",
    },
];

export interface ResolvedMergeOption {
    value: MergeMethod;
    label: string;
    description: string;
    allowed: boolean;
}

/** Applies repository settings to MERGE_OPTION_DEFS. */
export function resolveMergeOptions(
    repoData?: RepositoryInfo,
): ResolvedMergeOption[] {
    return MERGE_OPTION_DEFS.map((def) => ({
        value: def.value,
        label: def.label,
        description: def.description,
        allowed: repoData?.[def.setting] !== false,
    }));
}
