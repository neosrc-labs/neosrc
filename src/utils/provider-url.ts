export type Provider = "gh" | "cb";

export function domain(provider: Provider): string {
    return provider === "cb" ? "codeberg.org" : "github.com";
}

export function providerLabel(provider: Provider): string {
    return provider === "cb" ? "Codeberg" : "GitHub";
}

export function repoUrl(
    provider: Provider,
    owner: string,
    repo: string,
): string {
    return `https://${domain(provider)}/${owner}/${repo}`;
}

/** Percent-encode a repo-relative path for URL segments ("" stays ""). */
export function encodeRepoPath(path: string): string {
    return path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

/** In-app tree URL for `ref` + `path`; `path` "" is the repo root. */
export function treeHref(
    provider: Provider,
    owner: string,
    repo: string,
    ref: string,
    path?: string,
): string {
    const base = `/${provider}/${owner}/${repo}/tree/${encodeURIComponent(ref)}`;
    return path ? `${base}/${encodeRepoPath(path)}` : base;
}

/** In-app branch-list URL. */
export function branchesHref(
    provider: Provider,
    owner: string,
    repo: string,
): string {
    return `/${provider}/${owner}/${repo}/branches`;
}

/** In-app file URL for `ref` + `path`. */
export function blobHref(
    provider: Provider,
    owner: string,
    repo: string,
    ref: string,
    path: string,
): string {
    return `/${provider}/${owner}/${repo}/blob/${encodeURIComponent(ref)}/${encodeRepoPath(path)}`;
}

/** The provider's commit-history page for `path` at `ref`. */
export function historyUrl(
    provider: Provider,
    owner: string,
    repo: string,
    ref: string,
    path: string,
): string {
    const encodedPath = encodeRepoPath(path);
    const encodedRef = encodeURIComponent(ref);
    return provider === "cb"
        ? `https://codeberg.org/${owner}/${repo}/commits/branch/${encodedRef}/${encodedPath}`
        : `https://github.com/${owner}/${repo}/commits/${encodedRef}/${encodedPath}`;
}

/**
 * Provider compare page for `branch` against `base` (null base omits the range
 * start). Slashes are kept as separators, everything else percent-encoded.
 */
export function compareUrl(
    provider: Provider,
    owner: string,
    repo: string,
    branch: string,
    base: string | null,
): string {
    const target = branch.split("/").map(encodeURIComponent).join("/");
    const range = base
        ? `${base.split("/").map(encodeURIComponent).join("/")}...${target}`
        : target;
    return provider === "cb"
        ? `https://codeberg.org/${owner}/${repo}/compare/${range}`
        : `https://github.com/${owner}/${repo}/compare/${range}?expand=1`;
}

/** The provider's raw blob URL (githubusercontent / codeberg raw). */
export function rawUrl(
    provider: Provider,
    owner: string,
    repo: string,
    ref: string,
    path: string,
): string {
    const encoded = encodeRepoPath(path);
    const suffix = encoded ? `/${encoded}` : "";
    return provider === "cb"
        ? `https://codeberg.org/${owner}/${repo}/raw/branch/${ref}${suffix}`
        : `https://raw.githubusercontent.com/${owner}/${repo}/${ref}${suffix}`;
}
