import type { RepoContentItem } from "~/server/github";

/**
 * True when a contents listing for `path` is the path itself rather than the
 * children of a directory. Providers return one entry per child for a
 * directory, and a single entry whose `path` equals the request for a file,
 * symlink or submodule.
 */
export function isFileEntry(
    contents: RepoContentItem[] | undefined,
    path: string,
): boolean {
    if (path === "" || contents?.length !== 1) return false;
    const [entry] = contents;
    return entry !== undefined && entry.path === path && entry.type !== "dir";
}
