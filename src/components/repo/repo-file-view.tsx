"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "~/trpc/react";
import { cn, formatFileSize } from "~/utils/helpers";
import { type Provider, rawUrl, treeHref } from "~/utils/provider-url";
import { RepoBusyBar } from "./repo-busy-bar";
import { CodeView, FileBodySkeleton } from "./repo-code-view";
import { isFileEntry } from "./repo-contents";
import { RepoFileActions, RepoFileToolbar } from "./repo-file-toolbar";
import { RepoPathCommitRow } from "./repo-path-commit-row";
import { RepoPathNotFound } from "./repo-path-not-found";
import { contentsPrevious, fileContentPrevious } from "./repo-previous-data";

interface RepoFileViewProps {
    owner: string;
    repo: string;
    provider: Provider;
    selectedRef: string;
    /** Repo-relative file path. */
    path: string;
}

export function RepoFileView({
    owner,
    repo,
    provider,
    selectedRef,
    path,
}: RepoFileViewProps) {
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

    const busy =
        contentsStale ||
        contentQuery.isPlaceholderData ||
        (!contentsQuery.isPending && contentQuery.isFetching);

    const isFile = !contentsStale && isFileEntry(contents, path);
    const entry = isFile ? (contents?.[0] ?? null) : null;
    // Any other non-empty listing is the directory's children.
    const isDirectory =
        !contentsStale &&
        contents !== undefined &&
        contents.length > 0 &&
        !isFile;

    // A blob URL pointing at a directory lands on its tree page, as on GitHub.
    useEffect(() => {
        if (isDirectory) {
            router.replace(treeHref(provider, owner, repo, selectedRef, path));
        }
    }, [isDirectory, router, provider, owner, repo, selectedRef, path]);

    const pathMissing =
        contentsError !== null ||
        (!contentsStale && contents !== undefined && contents.length === 0);

    if (pathMissing) {
        return (
            <RepoPathNotFound
                provider={provider}
                owner={owner}
                repo={repo}
                selectedRef={selectedRef}
            />
        );
    }

    const name = path.split("/").pop() ?? path;
    const raw = rawUrl(provider, owner, repo, selectedRef, path);
    const content = fileData?.content ?? null;
    // "Binary file" only holds once the content request has answered.
    const contentLabel =
        content !== null
            ? `${content.split("\n").length.toLocaleString()} lines`
            : fileData === undefined
              ? ""
              : "Binary file";

    return (
        <>
            <RepoBusyBar busy={busy} />
            <RepoPathCommitRow
                owner={owner}
                repo={repo}
                provider={provider}
                selectedRef={selectedRef}
                path={path}
                view="blob"
                trailing={
                    entry?.type === "file" ? (
                        <span className="shrink-0 text-text-tertiary text-xs">
                            {formatFileSize(entry.size)}
                        </span>
                    ) : null
                }
            />

            <div className={cn(busy && "pointer-events-none opacity-60")}>
                <RepoFileToolbar
                    meta={contentLabel}
                    actions={
                        <RepoFileActions
                            name={name}
                            content={content}
                            rawHref={raw}
                        />
                    }
                />

                {contentQuery.error !== null ? (
                    <div className="px-6 py-12 text-center">
                        <p className="font-medium text-base text-text-primary">
                            Couldn&apos;t load this file.
                        </p>
                        <button
                            type="button"
                            onClick={() => contentQuery.refetch()}
                            className="mt-2 cursor-pointer text-blue-600 text-sm hover:underline dark:text-blue-400"
                        >
                            Try again
                        </button>
                    </div>
                ) : fileData === undefined ? (
                    <FileBodySkeleton />
                ) : content === null ? (
                    <div className="px-6 py-12 text-center">
                        <p className="font-medium text-base text-text-primary">
                            This file is binary or too large to display.
                        </p>
                        <a
                            href={raw}
                            className="mt-2 inline-block text-blue-600 text-sm hover:underline dark:text-blue-400"
                        >
                            View raw
                        </a>
                    </div>
                ) : (
                    <CodeView name={name} content={content} />
                )}
            </div>
        </>
    );
}
