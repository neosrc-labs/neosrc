import { createHash } from "node:crypto";
import { withStaleWhileRevalidate } from "~/server/cache";
import { createGraphql } from "~/server/github-graphql";
import { createOctokit } from "./client";

export interface FileLatestCommit {
    sha: string;
    message: string;
    committedDate: string | null;
}

interface GqlFileCommitNode {
    oid: string;
    messageHeadline: string;
    committedDate: string;
}

const FILE_COMMITS_CHUNK_SIZE = 50;

function buildFileCommitsBatchQuery(paths: string[]): string {
    const aliases = paths.map(
        (path, i) =>
            `    f${i}: history(first: 1, path: ${JSON.stringify(path)}) {\n      nodes {\n        oid\n        messageHeadline\n        committedDate\n      }\n    }`,
    );

    return `query BatchFileCommits($owner: String!, $repo: String!, $qualifiedRef: String!) {
  repository(owner: $owner, name: $repo) {
    ref(qualifiedName: $qualifiedRef) {
      target {
        ... on Commit {
${aliases.join("\n")}
        }
      }
    }
  }
}`;
}

function fileCommitsCacheKey(
    userId: string,
    owner: string,
    repo: string,
    ref: string,
    paths: string[],
): string {
    const sorted = [...paths].sort().join(",");
    const hash = createHash("sha256").update(sorted).digest("hex").slice(0, 16);
    return `file-commits:${userId}:${owner}:${repo}:${ref}:${hash}`;
}

export async function getFileLatestCommits(
    accessToken: string,
    userId: string,
    owner: string,
    repo: string,
    ref: string,
    paths: string[],
): Promise<Record<string, FileLatestCommit | null>> {
    if (paths.length === 0) return {};

    return withStaleWhileRevalidate(
        fileCommitsCacheKey(userId, owner, repo, ref, paths),
        () => fetchFileCommits(accessToken, owner, repo, ref, paths),
        {
            staleAfter: 24 * 60 * 60 * 1000,
            deleteAfter: 7 * 24 * 60 * 60 * 1000,
        },
    );
}

async function fetchFileCommits(
    accessToken: string,
    owner: string,
    repo: string,
    ref: string,
    paths: string[],
): Promise<Record<string, FileLatestCommit | null>> {
    const graphql = createGraphql(accessToken);

    const qualifiedRef = `refs/heads/${ref}`;
    const record: Record<string, FileLatestCommit | null> = {};

    for (let i = 0; i < paths.length; i += FILE_COMMITS_CHUNK_SIZE) {
        const chunk = paths.slice(i, i + FILE_COMMITS_CHUNK_SIZE);
        const query = buildFileCommitsBatchQuery(chunk);

        const result = await graphql<{
            repository?: {
                ref?: {
                    target?: Record<
                        string,
                        { nodes?: GqlFileCommitNode[] } | null
                    > | null;
                };
            };
        }>(query, {
            owner,
            repo,
            qualifiedRef,
        });

        const target = result.repository?.ref?.target ?? null;

        for (let j = 0; j < chunk.length; j++) {
            const path = chunk[j];
            if (!path) continue;
            const alias = `f${j}`;
            const history = target?.[alias] ?? null;
            const node = history?.nodes?.[0];
            if (node) {
                record[path] = {
                    sha: node.oid,
                    message: node.messageHeadline,
                    committedDate: node.committedDate,
                };
            } else {
                record[path] = null;
            }
        }
    }

    return record;
}

export interface CodeSearchResultItem {
    name: string;
    path: string;
    sha: string;
    htmlUrl: string;
    type: "blob" | "tree";
}

export async function getRepoFileTree(
    accessToken: string,
    owner: string,
    repo: string,
    ref: string,
): Promise<CodeSearchResultItem[]> {
    const octokit = createOctokit(accessToken);

    const { data: refData } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${ref}`,
    });

    const { data: commitData } = await octokit.rest.git.getCommit({
        owner,
        repo,
        commit_sha: refData.object.sha,
    });

    const { data: treeData } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: commitData.tree.sha,
        recursive: "true",
    });

    return treeData.tree
        .filter(
            (item): item is typeof item & { path: string; sha: string } =>
                !!item.path &&
                !!item.sha &&
                (item.type === "blob" || item.type === "tree"),
        )
        .map((item) => ({
            name: item.path.split("/").pop() ?? item.path,
            path: item.path,
            sha: item.sha,
            htmlUrl:
                item.type === "tree"
                    ? `https://github.com/${owner}/${repo}/tree/${encodeURIComponent(ref)}/${item.path.split("/").map(encodeURIComponent).join("/")}`
                    : `https://github.com/${owner}/${repo}/blob/${encodeURIComponent(ref)}/${item.path.split("/").map(encodeURIComponent).join("/")}`,
            type: item.type as "blob" | "tree",
        }));
}
