export type DiffViewMode = "unified" | "split";

const DIFF_VIEW_PREFIX = "diff-view:";

export function getDiffViewKey(owner: string, repo: string): string {
    return `${DIFF_VIEW_PREFIX}${owner}:${repo}`;
}

/** Read the persisted diff view mode; anything but "split" falls back to unified. */
export function readDiffViewPreference(
    owner: string,
    repo: string,
): DiffViewMode {
    if (typeof window === "undefined") return "unified";
    try {
        return localStorage.getItem(getDiffViewKey(owner, repo)) === "split"
            ? "split"
            : "unified";
    } catch {
        return "unified";
    }
}

export function writeDiffViewPreference(
    owner: string,
    repo: string,
    mode: DiffViewMode,
): void {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(getDiffViewKey(owner, repo), mode);
    } catch {
        // Storage unavailable (private mode, quota): the choice still applies
        // for this page load.
    }
}
