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
