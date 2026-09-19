"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { UndecoratedDirectoryEntry } from "~/server/repository/directory-browse";
import { api } from "~/trpc/react";
import {
    type Provider,
    type RepositoryReference,
    treeHref,
} from "~/utils/provider-url";
import {
    directoryBrowsePrevious,
    fileContentPrevious,
} from "./repo-previous-data";

export interface RepoFileData {
    /** The path's entry, or null when it is not a file at this ref. */
    entry: UndecoratedDirectoryEntry | null;
    /** Immutable object used by follow-up file and history requests. */
    objectId: string | null;
    /** File body; null for binary or too-large files. */
    content: string | null;
    /** "12 lines", "Binary file", or "" while the body is unknown. */
    contentLabel: string;
    /** True when the path does not exist at this ref. */
    pathMissing: boolean;
    /** True while placeholder data or a follow-up fetch is showing. */
    busy: boolean;
    /** True once the body request has failed. */
    contentFailed: boolean;
    /** Re-runs the body request. */
    retryContent: () => void;
}

/**
 * Path entry and file body of a repo file page, shared by the code and blame
 * views. A blob URL pointing at a directory redirects to its tree page, as on
 * GitHub.
 */
export function useRepoFileData({
    provider,
    owner,
    repo,
    reference,
    path,
}: {
    provider: Provider;
    owner: string;
    repo: string;
    reference: RepositoryReference;
    path: string;
}): RepoFileData {
    const router = useRouter();
    const queryKey = `${provider}/${owner}/${repo}/${reference.kind ?? "native"}/${reference.value}/${path}`;

    const browseQuery = api.repos.browseDirectory.useQuery(
        {
            provider,
            owner,
            repo,
            ref: reference.value,
            refKind: reference.kind,
            path,
        },
        { placeholderData: () => directoryBrowsePrevious.previous(queryKey) },
    );
    const browse = browseQuery.data;
    const browseStale = browseQuery.isPlaceholderData;

    useEffect(() => {
        if (!browseStale && browse !== undefined) {
            directoryBrowsePrevious.remember(queryKey, browse);
        }
    }, [browseStale, browse, queryKey]);

    const previousBrowse = directoryBrowsePrevious.previous(queryKey);
    const previousWasFile =
        previousBrowse?.outcome === "found" &&
        previousBrowse.classification.kind !== "directory";
    const classification =
        browse?.outcome === "found" ? browse.classification : null;
    const isFile =
        !browseStale &&
        classification !== null &&
        classification.kind !== "directory";
    const shouldFetchContent = isFile;
    const resolvedObjectId =
        !browseStale && browse?.outcome === "found"
            ? browse.reference.objectId
            : null;

    const contentQuery = api.repos.getFileContent.useQuery(
        {
            provider,
            owner,
            repo,
            ref: resolvedObjectId ?? reference.value,
            path,
        },
        {
            enabled: shouldFetchContent,
            placeholderData: previousWasFile
                ? () => fileContentPrevious.previous(queryKey)
                : undefined,
        },
    );
    const fileData = contentQuery.data;

    useEffect(() => {
        if (!contentQuery.isPlaceholderData && fileData !== undefined) {
            fileContentPrevious.remember(queryKey, fileData);
        }
    }, [contentQuery.isPlaceholderData, fileData, queryKey]);

    const isDirectory = !browseStale && classification?.kind === "directory";

    useEffect(() => {
        if (isDirectory) {
            router.replace(treeHref(provider, owner, repo, reference, path));
        }
    }, [isDirectory, router, provider, owner, repo, reference, path]);

    if (!browseStale && browseQuery.error !== null) {
        throw browseQuery.error;
    }

    const entry =
        !browseStale &&
        classification !== null &&
        classification.kind !== "directory"
            ? classification.entry
            : null;
    const pathMissing = !browseStale && browse?.outcome === "missing";
    const content = fileData?.content ?? null;

    return {
        objectId: resolvedObjectId,
        entry,
        content,
        contentLabel:
            content !== null
                ? `${content.split("\n").length.toLocaleString()} lines`
                : fileData === undefined
                  ? ""
                  : "Binary file",
        pathMissing,
        busy:
            browseQuery.isPending ||
            browseStale ||
            contentQuery.isPlaceholderData ||
            (isFile && contentQuery.isFetching),
        contentFailed: isFile && contentQuery.error !== null,
        retryContent: contentQuery.refetch,
    };
}
