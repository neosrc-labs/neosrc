import type {
    CommitDecoration,
    DirectoryBrowseAdapter,
    DirectoryEntryKind,
    RepositoryIdentity,
    ResolvedRepositoryReference,
    UndecoratedDirectoryEntry,
} from "~/server/repository/directory-browse";
import type { RepositoryReference } from "~/utils/provider-url";
import { createOctokit } from "./client";
import { getRepoContents, type RepoContentItem } from "./contents";
import { getFileLatestCommits } from "./tree";

function entryKind(
    kind: "file" | "dir" | "submodule" | "symlink",
): DirectoryEntryKind {
    return kind === "dir" ? "directory" : kind;
}

async function resolveGitObject(
    accessToken: string,
    repository: RepositoryIdentity,
    reference: RepositoryReference,
): Promise<string> {
    const octokit = createOctokit(accessToken);
    if (reference.kind === null || reference.kind === "commit") {
        const response = await octokit.repos.getCommit({
            ...repository,
            ref: reference.value,
        });
        return response.data.sha;
    }

    const response = await octokit.rest.git.getRef({
        ...repository,
        ref: `${reference.kind === "branch" ? "heads" : "tags"}/${reference.value}`,
    });
    let object = response.data.object;
    while (object.type === "tag") {
        const tag = await octokit.rest.git.getTag({
            ...repository,
            tag_sha: object.sha,
        });
        object = tag.data.object;
    }
    if (object.type !== "commit") {
        throw new Error(
            `${reference.kind} ${reference.value} does not resolve to a commit`,
        );
    }
    return object.sha;
}

function mapEntry(item: RepoContentItem): UndecoratedDirectoryEntry {
    return {
        kind: entryKind(item.type),
        name: item.name,
        path: item.path,
        objectId: item.sha,
        size: item.size,
    };
}

function isNotFound(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        error.status === 404
    );
}

export const githubDirectoryBrowseAdapter: DirectoryBrowseAdapter = {
    provider: "gh",

    async resolveReference(accessToken, repository, reference) {
        const objectId = await resolveGitObject(
            accessToken,
            repository,
            reference,
        );
        const resolvedReference: ResolvedRepositoryReference["reference"] =
            reference.kind === null
                ? { kind: "commit", value: objectId }
                : reference;
        return { reference: resolvedReference, objectId };
    },

    async readPath(accessToken, repository, objectId, path) {
        try {
            const items = await getRepoContents(
                accessToken,
                repository.owner,
                repository.repo,
                path || undefined,
                objectId,
            );
            const entries = items.map(mapEntry);
            const entry =
                path !== "" && entries.length === 1 ? entries[0] : null;
            if (entry && entry.path === path && entry.kind !== "directory") {
                return {
                    outcome: "found",
                    classification: { kind: entry.kind, entry },
                    entries: [],
                };
            }
            return {
                outcome: "found",
                classification: { kind: "directory" },
                entries,
            };
        } catch (error) {
            if (isNotFound(error)) return { outcome: "missing" };
            throw error;
        }
    },

    async readDecorations(execution, repository, objectId, entries) {
        const commits = await getFileLatestCommits(
            execution.accessToken,
            execution.userId,
            repository.owner,
            repository.repo,
            objectId,
            entries.map((entry) => entry.path),
        );
        return Object.fromEntries(
            entries.map((entry) => {
                const commit = commits[entry.path];
                const decoration: CommitDecoration | null = commit
                    ? {
                          objectId: commit.sha,
                          message: commit.message,
                          committedAt: commit.committedDate,
                      }
                    : null;
                return [entry.path, decoration];
            }),
        );
    },
};
