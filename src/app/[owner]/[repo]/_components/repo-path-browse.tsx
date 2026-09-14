"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo } from "react";
import { cn } from "~/lib/utils";
import type { RepoContentItem } from "~/server/github";
import { api } from "~/trpc/react";
import { blobHref, type Provider } from "~/utils/provider-url";
import { RepoBreadcrumb } from "./repo-breadcrumb";
import { RepoBusyBar } from "./repo-busy-bar";
import { RepoContentCard } from "./repo-content-card";
import { isFileEntry, sortRepoContents } from "./repo-contents";
import { RepoFileTable, RepoFileTableSkeleton } from "./repo-file-table";
import { RepoPathCommitRow } from "./repo-path-commit-row";
import { RepoPathNotFound } from "./repo-path-not-found";
import { contentsPrevious, fileCommitsPrevious } from "./repo-previous-data";

interface RepoPathBrowseProps {
    owner: string;
    repo: string;
    provider: Provider;
    selectedRef: string;
    /** Repo-relative directory path; never "" on a directory page. */
    path: string;
    children?: (contents: RepoContentItem[]) => ReactNode;
}

/**
 * Directory page body: the breadcrumb, the commit bar for the directory and
 * its listing, with no branch picker or search bar of its own. Those live in
 * the file tree rail.
 *
 * Navigating to another directory keeps the previous listing on screen, dimmed
 * and inert behind the busy bar, until the new one resolves.
 */
export function RepoPathBrowse({
    owner,
    repo,
    provider,
    selectedRef,
    path,
    children,
}: RepoPathBrowseProps) {
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
    // The rows on screen still belong to the path the user just left.
    const stale = contentsQuery.isPlaceholderData;

    useEffect(() => {
        if (!stale && contents !== undefined && contents.length > 0) {
            contentsPrevious.remember(queryKey, contents);
        }
    }, [stale, contents, queryKey]);

    const sortedContents = useMemo(
        () => sortRepoContents(contents ?? []),
        [contents],
    );

    const paths = useMemo(
        () => sortedContents.map((item) => item.path),
        [sortedContents],
    );

    const commitsQuery = api.repos.getFileLatestCommits.useQuery(
        {
            provider,
            owner,
            repo,
            ref: selectedRef,
            paths,
        },
        {
            // Stale rows would fetch the previous directory's commits.
            enabled: !stale && paths.length > 0,
            placeholderData: () => fileCommitsPrevious.previous(queryKey),
        },
    );
    const fileCommits = commitsQuery.data;

    useEffect(() => {
        if (!commitsQuery.isPlaceholderData && fileCommits !== undefined) {
            fileCommitsPrevious.remember(queryKey, fileCommits);
        }
    }, [commitsQuery.isPlaceholderData, fileCommits, queryKey]);

    const busy = stale || (!contentsQuery.isPending && commitsQuery.isFetching);

    // A tree URL that names a file lands on the file page, as on GitHub.
    const isFile = !stale && isFileEntry(sortedContents, path);
    useEffect(() => {
        if (isFile) {
            router.replace(blobHref(provider, owner, repo, selectedRef, path));
        }
    }, [isFile, router, provider, owner, repo, selectedRef, path]);

    const pathMissing =
        contentsError !== null ||
        (!stale && contents !== undefined && sortedContents.length === 0);

    if (pathMissing) {
        return (
            <>
                <RepoBreadcrumb
                    owner={owner}
                    repo={repo}
                    selectedRef={selectedRef}
                    provider={provider}
                    path={path}
                />
                <RepoContentCard>
                    <RepoPathNotFound
                        provider={provider}
                        owner={owner}
                        repo={repo}
                        selectedRef={selectedRef}
                    />
                </RepoContentCard>
            </>
        );
    }

    return (
        <>
            <RepoBreadcrumb
                owner={owner}
                repo={repo}
                selectedRef={selectedRef}
                provider={provider}
                path={path}
            />
            <RepoContentCard>
                <RepoBusyBar busy={busy} />
                <RepoPathCommitRow
                    owner={owner}
                    repo={repo}
                    provider={provider}
                    selectedRef={selectedRef}
                    path={path}
                    view="tree"
                />
                <div className={cn(busy && "pointer-events-none opacity-60")}>
                    {contentsQuery.isPending ? (
                        <RepoFileTableSkeleton />
                    ) : sortedContents.length === 0 ? (
                        <div className="p-8 text-center text-sm text-text-tertiary">
                            This directory is empty.
                        </div>
                    ) : (
                        <RepoFileTable
                            owner={owner}
                            repo={repo}
                            provider={provider}
                            selectedRef={selectedRef}
                            sortedContents={sortedContents}
                            fileCommits={fileCommits}
                        />
                    )}
                </div>
            </RepoContentCard>
            {children ? (
                <div className={cn(busy && "pointer-events-none opacity-60")}>
                    {children(sortedContents)}
                </div>
            ) : null}
        </>
    );
}
