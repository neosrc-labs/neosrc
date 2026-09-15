"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { RepoContentItem } from "~/server/github";
import { api } from "~/trpc/react";
import { type Provider, treeHref } from "~/utils/provider-url";
import { isFileEntry } from "./repo-contents";
import { contentsPrevious, fileContentPrevious } from "./repo-previous-data";

export interface RepoFileData {
    /** The path's entry, or null when it is not a file at this ref. */
    entry: RepoContentItem | null;
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
    selectedRef,
    path,
}: {
    provider: Provider;
    owner: string;
    repo: string;
    selectedRef: string;
    path: string;
}): RepoFileData {
    const router = useRouter();
    const queryKey = `${provider}/${owner}/${repo}/${selectedRef}/${path}`;

    const contentsQuery = api.repos.getContents.useQuery(
        {
            provider,
            owner,
            repo,
            ref: selectedRef,
            path,
        },
        { placeholderData: () => contentsPrevious.previous(queryKey) },
    );
    const contents = contentsQuery.data;
    const contentsError = contentsQuery.error;
    // The listing on screen still belongs to the path the user just left.
    const contentsStale = contentsQuery.isPlaceholderData;

    useEffect(() => {
        if (!contentsStale && contents !== undefined && contents.length > 0) {
            contentsPrevious.remember(queryKey, contents);
        }
    }, [contentsStale, contents, queryKey]);

    // Only a page that showed a file itself can supply a plausible body; a
    // directory listing means the remembered body is from an older page.
    const previousContents = contentsPrevious.previous(queryKey);
    const previousWasFile =
        previousContents?.length === 1 &&
        isFileEntry(previousContents, previousContents[0]?.path ?? "");

    const contentQuery = api.repos.getFileContent.useQuery(
        {
            provider,
            owner,
            repo,
            ref: selectedRef,
            path,
        },
        {
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

    const isFile = !contentsStale && isFileEntry(contents, path);
    const entry = isFile ? (contents?.[0] ?? null) : null;
    // Any other non-empty listing is the directory's children.
    const isDirectory =
        !contentsStale &&
        contents !== undefined &&
        contents.length > 0 &&
        !isFile;

    useEffect(() => {
        if (isDirectory) {
            router.replace(treeHref(provider, owner, repo, selectedRef, path));
        }
    }, [isDirectory, router, provider, owner, repo, selectedRef, path]);

    const pathMissing =
        contentsError !== null ||
        (!contentsStale && contents !== undefined && contents.length === 0);

    const content = fileData?.content ?? null;

    return {
        entry,
        content,
        // "Binary file" only holds once the content request has answered.
        contentLabel:
            content !== null
                ? `${content.split("\n").length.toLocaleString()} lines`
                : fileData === undefined
                  ? ""
                  : "Binary file",
        pathMissing,
        busy:
            contentsStale ||
            contentQuery.isPlaceholderData ||
            (!contentsQuery.isPending && contentQuery.isFetching),
        contentFailed: contentQuery.error !== null,
        retryContent: () => void contentQuery.refetch(),
    };
}
