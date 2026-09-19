"use client";

import { cn, formatFileSize } from "~/utils/helpers";
import {
    type Provider,
    type RepositoryReference,
    rawUrl,
} from "~/utils/provider-url";
import { RepoBusyBar } from "./repo-busy-bar";
import { CodeView, FileBodySkeleton } from "./repo-code-view";
import { useRepoFileData } from "./repo-file-data";
import { RepoFileTabs } from "./repo-file-tabs";
import { RepoFileActions, RepoFileToolbar } from "./repo-file-toolbar";
import { RepoPathCommitRow } from "./repo-path-commit-row";
import { RepoPathNotFound } from "./repo-path-not-found";

interface RepoFileViewProps {
    owner: string;
    repo: string;
    provider: Provider;
    reference: RepositoryReference;
    /** Repo-relative file path. */
    path: string;
}

export function RepoFileView({
    owner,
    repo,
    provider,
    reference,
    path,
}: RepoFileViewProps) {
    const {
        objectId,
        entry,
        content,
        contentLabel,
        pathMissing,
        busy,
        contentFailed,
        retryContent,
    } = useRepoFileData({ provider, owner, repo, reference, path });

    if (pathMissing) {
        return (
            <RepoPathNotFound
                provider={provider}
                owner={owner}
                repo={repo}
                selectedRef={reference.value}
            />
        );
    }

    const name = path.split("/").pop() ?? path;
    const raw = rawUrl(provider, owner, repo, reference.value, path);

    return (
        <>
            <RepoBusyBar busy={busy} />
            <RepoPathCommitRow
                owner={owner}
                repo={repo}
                provider={provider}
                reference={reference}
                resolvedObjectId={objectId}
                path={path}
                view="blob"
                trailing={
                    entry?.kind === "file" ? (
                        <span className="shrink-0 text-text-tertiary text-xs">
                            {formatFileSize(entry.size)}
                        </span>
                    ) : null
                }
            />

            <div className={cn(busy && "pointer-events-none opacity-60")}>
                <RepoFileToolbar
                    tabs={
                        <RepoFileTabs
                            provider={provider}
                            owner={owner}
                            repo={repo}
                            reference={reference}
                            path={path}
                            active="blob"
                        />
                    }
                    meta={contentLabel}
                    actions={
                        <RepoFileActions
                            name={name}
                            content={content}
                            rawHref={raw}
                        />
                    }
                />

                {contentFailed ? (
                    <div className="px-6 py-12 text-center">
                        <p className="font-medium text-base text-text-primary">
                            Couldn&apos;t load this file.
                        </p>
                        <button
                            type="button"
                            onClick={retryContent}
                            className="mt-2 cursor-pointer text-blue-600 text-sm hover:underline dark:text-blue-400"
                        >
                            Try again
                        </button>
                    </div>
                ) : contentLabel === "" ? (
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
