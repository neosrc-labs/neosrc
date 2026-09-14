export function isChangesPage(pathname: string): boolean {
    return (
        pathname?.includes("/pull/") &&
        (pathname.endsWith("/changes") || pathname.includes("/changes/"))
    );
}

export interface RepoBrowsePath {
    /** "tree" lists a directory; "blob" renders a file. */
    view: "tree" | "blob";
    /** Branch or tag from the URL. */
    ref: string;
    /** Repo-relative path; "" for the branch root. */
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
): RepoBrowsePath | null {
    const prefix = `${repoBase}/`;
    if (!pathname.startsWith(prefix)) return null;

    const [view, ref, ...rest] = pathname.slice(prefix.length).split("/");
    if (view !== "tree" && view !== "blob") return null;
    if (!ref) return null;

    return {
        view,
        ref: decodeSegment(ref),
        path: rest
            .filter((segment) => segment !== "")
            .map(decodeSegment)
            .join("/"),
    };
}
