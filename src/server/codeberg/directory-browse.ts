import type { CodebergBranchRaw, CodebergCommitRaw } from "~/server/codeberg";
import { codebergFetch } from "~/server/codeberg/fetch";
import type {
    CommitDecoration,
    DirectoryBrowseAdapter,
    DirectoryEntryKind,
    RepositoryIdentity,
    ResolvedRepositoryReference,
    UndecoratedDirectoryEntry,
} from "~/server/repository/directory-browse";
import { domain, type RepositoryReference } from "~/utils/provider-url";

const CODEBERG_API = `https://${domain("cb")}`;

interface CodebergTag {
    commit: { sha: string };
}

interface CodebergContent {
    type: "file" | "dir" | "submodule" | "symlink";
    name: string;
    path: string;
    sha: string;
    size: number;
}

const DECORATION_CONCURRENCY = 8;

async function errorMessage(res: Response, fallback: string): Promise<string> {
    const body = (await res.json().catch(() => null)) as {
        message?: string;
    } | null;
    return body?.message ?? `${fallback}: ${res.status}`;
}

async function fetchJson<T>(
    accessToken: string,
    url: string,
    fallback: string,
): Promise<T> {
    const res = await codebergFetch(accessToken, url);
    if (!res.ok) throw new Error(await errorMessage(res, fallback));
    return res.json() as Promise<T>;
}

async function resolveObjectId(
    accessToken: string,
    repository: RepositoryIdentity,
    reference: RepositoryReference,
): Promise<string> {
    const base = `${CODEBERG_API}/api/v1/repos/${repository.owner}/${repository.repo}`;
    if (reference.kind === "branch") {
        const branch = await fetchJson<CodebergBranchRaw>(
            accessToken,
            `${base}/branches/${encodeURIComponent(reference.value)}`,
            `Failed to resolve branch ${reference.value}`,
        );
        return branch.commit.id;
    }
    if (reference.kind === "tag") {
        const tag = await fetchJson<CodebergTag>(
            accessToken,
            `${base}/tags/${encodeURIComponent(reference.value)}`,
            `Failed to resolve tag ${reference.value}`,
        );
        return tag.commit.sha;
    }

    const params = new URLSearchParams({
        sha: reference.value,
        limit: "1",
    });
    const commits = await fetchJson<CodebergCommitRaw[]>(
        accessToken,
        `${base}/commits?${params}`,
        `Failed to resolve ${reference.value}`,
    );
    const commit = commits[0];
    if (!commit) throw new Error(`No commit found for ${reference.value}`);
    return commit.sha;
}

function entryKind(kind: CodebergContent["type"]): DirectoryEntryKind {
    return kind === "dir" ? "directory" : kind;
}

function mapEntry(item: CodebergContent): UndecoratedDirectoryEntry {
    return {
        kind: entryKind(item.type),
        name: item.name,
        path: item.path,
        objectId: item.sha,
        size: item.size,
    };
}

async function readEntryCommit(
    accessToken: string,
    repository: RepositoryIdentity,
    objectId: string,
    path: string,
): Promise<CommitDecoration | null> {
    const params = new URLSearchParams({
        sha: objectId,
        path,
        limit: "1",
    });
    const url = `${CODEBERG_API}/api/v1/repos/${repository.owner}/${repository.repo}/commits?${params}`;
    const res = await codebergFetch(accessToken, url);
    if (!res.ok) throw new Error(`Failed to decorate ${path}: ${res.status}`);
    const commits = (await res.json()) as CodebergCommitRaw[];
    const commit = commits[0];
    if (!commit) return null;
    return {
        objectId: commit.sha,
        message: commit.commit.message.split("\n")[0] ?? "",
        committedAt:
            commit.commit.committer?.date ?? commit.commit.author?.date ?? null,
    };
}

export const codebergDirectoryBrowseAdapter: DirectoryBrowseAdapter = {
    provider: "cb",

    async resolveReference(accessToken, repository, reference) {
        const objectId = await resolveObjectId(
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
        const urlPath = path
            ? `/${path.split("/").map(encodeURIComponent).join("/")}`
            : "";
        const params = new URLSearchParams({ ref: objectId });
        const url = `${CODEBERG_API}/api/v1/repos/${repository.owner}/${repository.repo}/contents${urlPath}?${params}`;
        const res = await codebergFetch(accessToken, url);
        if (res.status === 404) return { outcome: "missing" };
        if (!res.ok) {
            throw new Error(
                await errorMessage(res, `Failed to read ${path || "/"}`),
            );
        }
        const body = (await res.json()) as CodebergContent | CodebergContent[];
        const items = Array.isArray(body) ? body : [body];
        const entries = items.map(mapEntry);
        const entry = path !== "" && entries.length === 1 ? entries[0] : null;
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
    },

    async readDecorations(execution, repository, objectId, entries) {
        const decorations: Record<string, CommitDecoration | null> = {};
        let next = 0;
        const workers = Array.from(
            { length: Math.min(DECORATION_CONCURRENCY, entries.length) },
            async () => {
                for (;;) {
                    const entry = entries[next++];
                    if (!entry) return;
                    try {
                        decorations[entry.path] = await readEntryCommit(
                            execution.accessToken,
                            repository,
                            objectId,
                            entry.path,
                        );
                    } catch {
                        decorations[entry.path] = null;
                    }
                }
            },
        );
        await Promise.all(workers);
        return decorations;
    },
};
