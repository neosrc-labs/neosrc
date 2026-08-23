import { withStaleWhileRevalidate } from "~/server/cache";
import { createGraphql } from "~/server/github-graphql";
import { createOctokit } from "./client";

export interface RepoContentItem {
    type: "file" | "dir" | "submodule" | "symlink";
    name: string;
    path: string;
    sha: string;
    size: number;
    htmlUrl: string | null;
}

export async function getRepoContents(
    accessToken: string,
    owner: string,
    repo: string,
    path?: string,
    ref?: string,
): Promise<RepoContentItem[]> {
    const octokit = createOctokit(accessToken);
    const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: path ?? "",
        ref,
    });

    if (Array.isArray(data)) {
        return data.map((item) => ({
            type: item.type as RepoContentItem["type"],
            name: item.name,
            path: item.path,
            sha: item.sha,
            size: item.size,
            htmlUrl: item.html_url ?? null,
        }));
    }

    return [
        {
            type: data.type as RepoContentItem["type"],
            name: data.name,
            path: data.path,
            sha: data.sha,
            size: data.size,
            htmlUrl: data.html_url ?? null,
        },
    ];
}

export interface RepoDocFile {
    name: string;
    path: string;
    content: string;
}

export interface RepoDocFileName {
    name: string;
    path: string;
    displayName: string;
}

export const DOC_FILE_PATTERNS = [
    /^readme/i,
    /^contributing\.md$/i,
    /^code_of_conduct\.md$/i,
    /^(licen[cs]e|copying)/i,
];

const PRIORITY_ORDER: Record<string, number> = {
    readme: 0,
    contributing: 1,
    code_of_conduct: 2,
};

export function getDocFileSortKey(name: string): string {
    const base = name.replace(/\.[^.]+$/, "").toLowerCase();
    const priority = PRIORITY_ORDER[base];
    if (priority !== undefined) {
        return String(priority).padStart(3, "0");
    }
    return `zzz${name.toLowerCase()}`;
}

export function getDocFileDisplayName(name: string): string {
    const base = name.replace(/\.[^.]+$/, "");
    const lowerBase = base.toLowerCase();

    if (/^readme/i.test(name)) return "README";
    if (/^contributing/i.test(name)) return "Contributing";
    if (/^code_of_conduct/i.test(name)) return "Code of Conduct";

    if (/mit/i.test(lowerBase)) return "MIT License";
    if (/apache/i.test(lowerBase)) return "Apache-2.0 License";
    if (/gpl/i.test(lowerBase)) return "GPL License";
    if (/bsd/i.test(lowerBase)) return "BSD License";
    if (/mpl/i.test(lowerBase)) return "MPL License";

    return base;
}

export async function getRepoDocFileNames(
    accessToken: string,
    owner: string,
    repo: string,
    ref?: string,
): Promise<RepoDocFileName[]> {
    const octokit = createOctokit(accessToken);

    const { data: rootData } = await octokit.rest.repos.getContent({
        owner,
        repo,
        ref,
        path: "",
    });

    const items = Array.isArray(rootData) ? rootData : [rootData];

    const docItems = items.filter(
        (item) =>
            item.type === "file" &&
            DOC_FILE_PATTERNS.some((p) => p.test(item.name)),
    );

    return docItems
        .map((item) => ({
            name: item.name,
            path: item.path,
            displayName: getDocFileDisplayName(item.name),
        }))
        .sort((a, b) =>
            getDocFileSortKey(a.name).localeCompare(getDocFileSortKey(b.name)),
        );
}

export async function getDocFileContent(
    accessToken: string,
    owner: string,
    repo: string,
    ref: string,
    path: string,
): Promise<{ content: string }> {
    const graphql = createGraphql(accessToken);

    const query = `query GetDocFile($owner: String!, $repo: String!, $expression: String!) {
  repository(owner: $owner, name: $repo) {
    object(expression: $expression) {
      ... on Blob {
        text
      }
    }
  }
}`;

    const result = await graphql<{
        repository?: {
            object?: { text?: string | null } | null;
        };
    }>(query, {
        owner,
        repo,
        expression: `${ref}:${path}`,
    });

    const text = result.repository?.object?.text;
    if (text == null) {
        throw new Error(`File not found: ${path}`);
    }

    return { content: text };
}

export async function getCachedDocFileContent(
    accessToken: string,
    userId: string,
    owner: string,
    repo: string,
    ref: string,
    path: string,
): Promise<{ content: string }> {
    return withStaleWhileRevalidate(
        `doc-file:${userId}:${owner}:${repo}:${ref}:${path}`,
        () => getDocFileContent(accessToken, owner, repo, ref, path),
        {
            staleAfter: 24 * 60 * 60 * 1000,
            deleteAfter: 7 * 24 * 60 * 60 * 1000,
        },
    );
}

export async function getRepoDocFiles(
    accessToken: string,
    owner: string,
    repo: string,
    ref?: string,
): Promise<RepoDocFile[]> {
    const octokit = createOctokit(accessToken);

    const { data: rootData } = await octokit.rest.repos.getContent({
        owner,
        repo,
        ref,
        path: "",
    });

    const items = Array.isArray(rootData) ? rootData : [rootData];

    const docItems = items.filter(
        (item) =>
            item.type === "file" &&
            DOC_FILE_PATTERNS.some((p) => p.test(item.name)),
    );

    const results = await Promise.all(
        docItems.map(async (item) => {
            try {
                const { data: fileData } = await octokit.rest.repos.getContent({
                    owner,
                    repo,
                    path: item.path,
                    ref,
                });

                if (Array.isArray(fileData)) return null;
                if (fileData.type !== "file" || !fileData.content) return null;

                const content = Buffer.from(
                    fileData.content,
                    "base64",
                ).toString("utf-8");
                return {
                    name: fileData.name,
                    path: fileData.path,
                    content,
                };
            } catch {
                return null;
            }
        }),
    );

    return results
        .filter((f): f is RepoDocFile => f !== null)
        .sort((a, b) =>
            getDocFileSortKey(a.name).localeCompare(getDocFileSortKey(b.name)),
        );
}

export async function getRepoLanguages(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<Record<string, number>> {
    const octokit = createOctokit(accessToken);
    const { data } = await octokit.rest.repos.listLanguages({ owner, repo });
    return data;
}
