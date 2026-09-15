export interface DocFileName {
    name: string;
    path: string;
    displayName: string;
}

/** Filenames that render as repo docs (README, CONTRIBUTING, LICENSE, ...). */
export const DOC_FILE_PATTERNS = [
    /^readme/i,
    /^contributing\.md$/i,
    /^code_of_conduct\.md$/i,
    /^(licen[cs]e|copying)/i,
];

const PRIORITY_ORDER: Record<string, number> = {
    readme: 0,
    contributing: 1,
    code_of_conduct: 2,
};

/** Sort key that orders README first, then CONTRIBUTING, then the rest. */
export function getDocFileSortKey(name: string): string {
    const base = name.replace(/\.[^.]+$/, "").toLowerCase();
    const priority = PRIORITY_ORDER[base];
    if (priority !== undefined) {
        return String(priority).padStart(3, "0");
    }
    return `zzz${name.toLowerCase()}`;
}

/** Tab label for a doc file, e.g. "MIT License" for LICENSE-MIT. */
export function getDocFileDisplayName(name: string): string {
    const base = name.replace(/\.[^.]+$/, "");
    const lowerBase = base.toLowerCase();

    if (/^readme/i.test(name)) return "README";
    if (/^contributing/i.test(name)) return "Contributing";
    if (/^code_of_conduct/i.test(name)) return "Code of Conduct";

    if (/mit/i.test(lowerBase)) return "MIT License";
    if (/apache/i.test(lowerBase)) return "Apache-2.0 License";
    if (/gpl/i.test(lowerBase)) return "GPL License";
    if (/bsd/i.test(lowerBase)) return "BSD License";
    if (/mpl/i.test(lowerBase)) return "MPL License";

    return base;
}

/** Stable tab/hash id for a repo doc file (README, CONTRIBUTING, LICENSE, ...). */
export function getDocFileHashName(name: string): string {
    if (/^readme/i.test(name)) return "readme";
    if (/^contributing/i.test(name)) return "contributing";
    if (/^code_of_conduct/i.test(name)) return "code-of-conduct";
    if (/^(licen[cs]e|copying)/i.test(name)) return "license";
    return name.toLowerCase().replace(/\.[^.]+$/, "");
}

/** Doc files among a directory listing, in display order. */
export function pickDocFileNames(
    items: { name: string; path: string; type: string }[],
): DocFileName[] {
    return items
        .filter(
            (item) =>
                item.type === "file" &&
                DOC_FILE_PATTERNS.some((p) => p.test(item.name)),
        )
        .map((item) => ({
            name: item.name,
            path: item.path,
            displayName: getDocFileDisplayName(item.name),
        }))
        .sort((a, b) =>
            getDocFileSortKey(a.name).localeCompare(getDocFileSortKey(b.name)),
        );
}
