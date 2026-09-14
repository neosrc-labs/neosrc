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
