export type Provider = "gh" | "cb";

export function domain(provider: Provider): string {
    return provider === "cb" ? "codeberg.org" : "github.com";
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
