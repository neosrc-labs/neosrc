import "server-only";

import { withStaleWhileRevalidate } from "~/server/cache";
import type { Provider, RepositoryReference } from "~/utils/provider-url";

export interface ResolvedRepositoryReference {
    reference: RepositoryReference;
    objectId: string;
}

export interface RepositoryIdentity {
    owner: string;
    repo: string;
}

export type DirectoryEntryKind = "directory" | "file" | "symlink" | "submodule";

export interface CommitDecoration {
    objectId: string;
    message: string;
    committedAt: string | null;
}

export interface UndecoratedDirectoryEntry {
    kind: DirectoryEntryKind;
    name: string;
    path: string;
    objectId: string;
    size: number;
}

export interface DirectoryEntry extends UndecoratedDirectoryEntry {
    commit: CommitDecoration | null;
}

export type DirectoryPathClassification =
    | { kind: "directory" }
    | {
          kind: "file" | "symlink" | "submodule";
          entry: UndecoratedDirectoryEntry;
      };

export type DirectoryBrowseResult =
    | {
          outcome: "missing";
          reference: ResolvedRepositoryReference;
          path: string;
      }
    | {
          outcome: "found";
          reference: ResolvedRepositoryReference;
          path: string;
          classification: DirectoryPathClassification;
          entries: DirectoryEntry[];
      };

export interface DirectoryBrowseInput {
    provider: Provider;
    repository: RepositoryIdentity;
    reference: RepositoryReference;
    path: string;
}

export interface DirectoryBrowseExecution {
    accessToken: string;
    userId: string;
}

export type ReadDirectoryPathResult =
    | { outcome: "missing" }
    | {
          outcome: "found";
          classification: DirectoryPathClassification;
          entries: UndecoratedDirectoryEntry[];
      };

export interface DirectoryBrowseAdapter {
    readonly provider: Provider;
    resolveReference(
        accessToken: string,
        repository: RepositoryIdentity,
        reference: RepositoryReference,
    ): Promise<ResolvedRepositoryReference>;
    readPath(
        accessToken: string,
        repository: RepositoryIdentity,
        objectId: string,
        path: string,
    ): Promise<ReadDirectoryPathResult>;
    readDecorations(
        execution: DirectoryBrowseExecution,
        repository: RepositoryIdentity,
        objectId: string,
        entries: UndecoratedDirectoryEntry[],
    ): Promise<Record<string, CommitDecoration | null>>;
}

function cacheKey(
    provider: Provider,
    userId: string,
    repository: RepositoryIdentity,
    reference: ResolvedRepositoryReference,
    path: string,
): string {
    return [
        "directory-browse:v1",
        provider,
        userId,
        repository.owner,
        repository.repo,
        reference.reference.kind ?? "native",
        encodeURIComponent(reference.reference.value),
        reference.objectId,
        encodeURIComponent(path),
    ].join(":");
}

function normalizePath(path: string): string {
    return path.split("/").filter(Boolean).join("/");
}

function sortEntries(entries: DirectoryEntry[]): DirectoryEntry[] {
    return entries.sort((a, b) => {
        if (a.kind === "directory" && b.kind !== "directory") return -1;
        if (a.kind !== "directory" && b.kind === "directory") return 1;
        return a.name.localeCompare(b.name);
    });
}

export async function browseDirectory(
    adapter: DirectoryBrowseAdapter,
    execution: DirectoryBrowseExecution,
    input: DirectoryBrowseInput,
): Promise<DirectoryBrowseResult> {
    if (input.provider !== adapter.provider) {
        throw new Error(
            `Directory browse adapter ${adapter.provider} cannot handle ${input.provider}`,
        );
    }

    const path = normalizePath(input.path);
    const reference = await adapter.resolveReference(
        execution.accessToken,
        input.repository,
        input.reference,
    );

    return withStaleWhileRevalidate(
        cacheKey(
            input.provider,
            execution.userId,
            input.repository,
            reference,
            path,
        ),
        async () => {
            const read = await adapter.readPath(
                execution.accessToken,
                input.repository,
                reference.objectId,
                path,
            );
            if (read.outcome === "missing") {
                return { outcome: "missing", reference, path };
            }
            if (read.classification.kind !== "directory") {
                return {
                    outcome: "found",
                    reference,
                    path,
                    classification: read.classification,
                    entries: [],
                };
            }

            let decorations: Record<string, CommitDecoration | null> = {};
            try {
                decorations = await adapter.readDecorations(
                    execution,
                    input.repository,
                    reference.objectId,
                    read.entries,
                );
            } catch {
                // Decoration cannot make a directory unavailable.
            }

            const entries = sortEntries(
                read.entries.map((entry) => ({
                    ...entry,
                    commit: decorations[entry.path] ?? null,
                })),
            );
            return {
                outcome: "found",
                reference,
                path,
                classification: read.classification,
                entries,
            };
        },
        {
            staleAfter: 5 * 60 * 1000,
            deleteAfter: 7 * 24 * 60 * 60 * 1000,
        },
    );
}
