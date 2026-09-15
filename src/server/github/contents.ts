import { withStaleWhileRevalidate } from "~/server/cache";
import { createGraphql } from "~/server/github-graphql";
import {
    DOC_FILE_PATTERNS,
    type DocFileName,
    getDocFileSortKey,
    pickDocFileNames,
} from "~/utils/doc-files";
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

export async function getRepoDocFileNames(
    accessToken: string,
    owner: string,
    repo: string,
    ref?: string,
): Promise<DocFileName[]> {
    const octokit = createOctokit(accessToken);

    const { data: rootData } = await octokit.rest.repos.getContent({
        owner,
        repo,
        ref,
        path: "",
    });

    const items = Array.isArray(rootData) ? rootData : [rootData];

    return pickDocFileNames(items);
}

export async function getFileContent(
    accessToken: string,
    owner: string,
    repo: string,
    ref: string,
    path: string,
): Promise<{ content: string | null }> {
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

    // A null blob text means binary content or a file past the GraphQL blob
    // limit; the caller shows a notice instead of the file body.
    return { content: result.repository?.object?.text ?? null };
}

export async function getCachedFileContent(
    accessToken: string,
    userId: string,
    owner: string,
    repo: string,
    ref: string,
    path: string,
): Promise<{ content: string | null }> {
    return withStaleWhileRevalidate(
        `file-content:${userId}:${owner}:${repo}:${ref}:${path}`,
        () => getFileContent(accessToken, owner, repo, ref, path),
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
