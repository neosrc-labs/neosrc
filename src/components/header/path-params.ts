import type { Provider } from "~/utils/provider-url";
import type { PathType } from "./types";

export interface ParsedRepoPath {
    provider: Provider;
    owner: string | null;
    repo: string | null;
    pullRequestNumber: number | null;
    pathType: PathType | null;
}

// Parses "/:provider/:owner/:repo" header paths. The /gh or /cb prefix is
// optional; a path without it is treated as GitHub.
export function parseRepoPath(pathname: string): ParsedRepoPath {
    const provider: Provider = pathname.startsWith("/cb/") ? "cb" : "gh";
    // Strip optional /gh or /cb prefix for owner/repo extraction
    const cleanPath = pathname.replace(/^\/(?:gh|cb)(?=\/)/, "");

    const repoMatch = cleanPath.match(/^\/([^/]+)\/([^/]+)/);
    const owner = repoMatch?.[1] ?? null;
    const repo = repoMatch?.[2] ?? null;

    let pathType: PathType | null = null;

    let pullRequestNumber: number | null = null;
    if (repoMatch) {
        const prMatch = cleanPath.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
        const pullsMatch = cleanPath.match(/^\/([^/]+)\/([^/]+)\/pulls/);
        const issuesMatch = cleanPath.match(/^\/([^/]+)\/([^/]+)\/issues/);
        if (pullsMatch) {
            pathType = "PULLS_LIST";
        } else if (issuesMatch) {
            pathType = "ISSUES_LIST";
        } else if (prMatch) {
            pathType = "PULL_REQUEST";
            if (prMatch[3]) {
                pullRequestNumber = parseInt(prMatch[3], 10);
            }
        } else {
            pathType = "REPO";
        }
    }

    return {
        provider,
        owner,
        repo,
        pullRequestNumber,
        pathType,
    };
}
