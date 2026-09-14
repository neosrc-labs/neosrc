"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo } from "react";
import type { RepoContentItem } from "~/server/github";
import { api } from "~/trpc/react";
import { blobHref, type Provider } from "~/utils/provider-url";
import { RepoBreadcrumb } from "./repo-breadcrumb";
import { RepoCommitRowSkeleton } from "./repo-commit-row";
import { RepoContentCard } from "./repo-content-card";
import { isFileEntry, sortRepoContents } from "./repo-contents";
import { RepoFileTable, RepoFileTableSkeleton } from "./repo-file-table";
import { RepoPathCommitRow } from "./repo-path-commit-row";
import { RepoPathNotFound } from "./repo-path-not-found";

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

    const {
        data: contents,
        isLoading: contentsLoading,
        error: contentsError,
    } = api.repos.getContents.useQuery({
        provider,
        owner,
        repo,
        ref: selectedRef,
        path,
    });

    const sortedContents = useMemo(
        () => sortRepoContents(contents ?? []),
        [contents],
    );

    const paths = useMemo(
        () => sortedContents.map((item) => item.path),
        [sortedContents],
    );

    const { data: fileCommits, isLoading: fileCommitsLoading } =
        api.repos.getFileLatestCommits.useQuery(
            {
                provider,
                owner,
                repo,
                ref: selectedRef,
                paths,
            },
            { enabled: paths.length > 0 },
        );

    // A tree URL that names a file lands on the file page, as on GitHub.
    const isFile = isFileEntry(sortedContents, path);
    useEffect(() => {
        if (isFile) {
            router.replace(blobHref(provider, owner, repo, selectedRef, path));
        }
    }, [isFile, router, provider, owner, repo, selectedRef, path]);

    const pathMissing =
        contentsError !== null ||
        (contents !== undefined && sortedContents.length === 0);

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
                <RepoPathCommitRow
                    owner={owner}
                    repo={repo}
                    provider={provider}
                    selectedRef={selectedRef}
                    path={path}
                    view="tree"
                />
                {contentsLoading || fileCommitsLoading ? (
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
            </RepoContentCard>
            {children?.(sortedContents)}
        </>
    );
}

/** Loading state matching `RepoPathBrowse`'s breadcrumb, commit bar and table. */
export function RepoPathBrowseSkeleton() {
    return (
        <>
            <div className="pb-3">
                <div className="h-4 w-56 animate-pulse rounded bg-surface-secondary" />
            </div>
            <RepoContentCard>
                <RepoCommitRowSkeleton />
                <RepoFileTableSkeleton />
            </RepoContentCard>
        </>
    );
}
