import {
    parseRepositoryReference,
    type RepositoryReference,
} from "./provider-url";
export function isChangesPage(pathname: string): boolean {
    return (
        pathname?.includes("/pull/") &&
        (pathname.endsWith("/changes") || pathname.includes("/changes/"))
    );
}

export interface RepoBrowsePath {
    /** "tree" lists a directory; "blob" renders a file; "blame" its authorship. */
    view: "tree" | "blob" | "blame";
    reference: RepositoryReference;
    /** Repo-relative path; "" for the reference root. */
    path: string;
}

/** Percent-decodes one URL segment, keeping the raw value when malformed. */
function decodeSegment(segment: string): string {
    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
}

/**
 * View, ref and path of a repo file-browser URL, or null for any other path.
 * `repoBase` is the repo's URL prefix without a trailing slash, e.g.
 * `/gh/rust-lang/cargo`; owner and repo names are never percent-encoded.
 */
export function parseRepoBrowsePath(
    pathname: string,
    repoBase: string,
    refKind: string | null,
): RepoBrowsePath | null {
    const prefix = `${repoBase}/`;
    if (!pathname.startsWith(prefix)) return null;

    const [view, ref, ...rest] = pathname.slice(prefix.length).split("/");
    if (view !== "tree" && view !== "blob" && view !== "blame") return null;
    if (!ref) return null;
    const reference = parseRepositoryReference(decodeSegment(ref), refKind);
    if (!reference) return null;

    return {
        view,
        reference,
        path: rest
            .filter((segment) => segment !== "")
            .map(decodeSegment)
            .join("/"),
    };
}
