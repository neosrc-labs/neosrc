import folderIconMapData from "~/utils/folder-icon-map.json";
import iconMapData from "~/utils/iconMap.json";

const iconMap = iconMapData as Record<string, string>;
const folderIconMap = folderIconMapData.folderNames as Record<string, string>;
const folderIconMapExpanded = folderIconMapData.folderNamesExpanded as Record<
    string,
    string
>;

export function getFileIconName(filename: string): string {
    const parts = filename.split(".");
    if (parts.length > 1) {
        const ext = parts.pop()?.toLowerCase();
        return ext ? (iconMap[ext] ?? "file") : "file";
    }
    return "file";
}

export function getFolderIconName(name: string, expanded = false): string {
    const map = expanded ? folderIconMapExpanded : folderIconMap;
    for (const candidate of folderNameVariants(name)) {
        const icon = map[candidate];
        if (icon) return icon;
    }
    for (const candidate of folderNameVariants(name.toLowerCase())) {
        const icon = map[candidate];
        if (icon) return icon;
    }
    return expanded ? "folder-open" : "folder";
}

// The material icon theme maps hidden/private folder variants (.src, _src,
// -src, __src__) to the same icon as the plain name. Resolve those variants.
function folderNameVariants(name: string): string[] {
    const candidates = [name];
    if (
        name.length > 1 &&
        (name[0] === "." || name[0] === "_" || name[0] === "-")
    ) {
        candidates.push(name.slice(1));
    }
    if (name.length > 4 && name.startsWith("__") && name.endsWith("__")) {
        candidates.push(name.slice(2, -2));
    }
    return candidates;
}
