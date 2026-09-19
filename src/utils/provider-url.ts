export type Provider = "gh" | "cb";

export type ReferenceKind = "branch" | "tag" | "commit";

export interface RepositoryReference {
    kind: ReferenceKind | null;
    value: string;
}

export function parseRepositoryReference(
    value: string,
    kind: string | string[] | null | undefined,
): RepositoryReference | null {
    const normalizedKind = kind ?? null;
    if (
        Array.isArray(normalizedKind) ||
        (normalizedKind !== null &&
            normalizedKind !== "branch" &&
            normalizedKind !== "tag" &&
            normalizedKind !== "commit")
    ) {
        return null;
    }
    return { kind: normalizedKind, value };
}

function withReferenceKind(
    href: string,
    reference: RepositoryReference,
): string {
    return reference.kind ? `${href}?refKind=${reference.kind}` : href;
}

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

/** In-app tree URL for a reference and path; path "" is the repo root. */
export function treeHref(
    provider: Provider,
    owner: string,
    repo: string,
    reference: RepositoryReference,
    path?: string,
): string {
    const base = `/${provider}/${owner}/${repo}/tree/${encodeURIComponent(reference.value)}`;
    const href = path ? `${base}/${encodeRepoPath(path)}` : base;
    return withReferenceKind(href, reference);
}

/** In-app branch-list URL. */
export function branchesHref(
    provider: Provider,
    owner: string,
    repo: string,
): string {
    return `/${provider}/${owner}/${repo}/branches`;
}

/** In-app commit-history URL for a repository reference. */
export function commitsHref(
    provider: Provider,
    owner: string,
    repo: string,
    reference: RepositoryReference,
): string {
    const href = `/${provider}/${owner}/${repo}/commits/${encodeURIComponent(reference.value)}`;
    return withReferenceKind(href, reference);
}

/** In-app file URL for a repository reference and path. */
export function blobHref(
    provider: Provider,
    owner: string,
    repo: string,
    reference: RepositoryReference,
    path: string,
): string {
    const href = `/${provider}/${owner}/${repo}/blob/${encodeURIComponent(reference.value)}/${encodeRepoPath(path)}`;
    return withReferenceKind(href, reference);
}

/** In-app blame URL for a repository reference and path. */
export function blameHref(
    provider: Provider,
    owner: string,
    repo: string,
    reference: RepositoryReference,
    path: string,
): string {
    const href = `/${provider}/${owner}/${repo}/blame/${encodeURIComponent(reference.value)}/${encodeRepoPath(path)}`;
    return withReferenceKind(href, reference);
}

/** The provider's commit-history page for `path` at `reference`. */
export function historyUrl(
    provider: Provider,
    owner: string,
    repo: string,
    reference: RepositoryReference,
    path: string,
): string {
    const encodedPath = encodeRepoPath(path);
    const encodedRef = encodeURIComponent(reference.value);
    return provider === "cb"
        ? `https://codeberg.org/${owner}/${repo}/commits/${reference.kind ?? "branch"}/${encodedRef}/${encodedPath}`
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

/**
 * Keeps named branch/tag raw links readable while pinning native or commit
 * references to the resolved object.
 */
export function rawContentReference(
    reference: RepositoryReference,
    resolvedObjectId: string | null,
): RepositoryReference {
    if (reference.kind === "branch" || reference.kind === "tag") {
        return reference;
    }
    return {
        kind: "commit",
        value: resolvedObjectId ?? reference.value,
    };
}

/** The provider's raw blob URL. */
export function rawUrl(
    provider: Provider,
    owner: string,
    repo: string,
    reference: RepositoryReference,
    path: string,
): string {
    const encoded = encodeRepoPath(path);
    const suffix = encoded ? `/${encoded}` : "";
    const encodedRef = encodeURIComponent(reference.value);
    return provider === "cb"
        ? `https://codeberg.org/${owner}/${repo}/raw/${reference.kind ?? "branch"}/${encodedRef}${suffix}`
        : `https://raw.githubusercontent.com/${owner}/${repo}/${reference.value}${suffix}`;
}
