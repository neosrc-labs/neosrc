"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import type { DirectoryEntry } from "~/server/repository/directory-browse";
import { api } from "~/trpc/react";
import { cn } from "~/utils/helpers";
import {
    blobHref,
    type Provider,
    type RepositoryReference,
} from "~/utils/provider-url";
import { RepoBreadcrumb } from "./repo-breadcrumb";
import { RepoBusyBar } from "./repo-busy-bar";
import { RepoContentCard } from "./repo-content-card";
import { RepoFileTable, RepoFileTableSkeleton } from "./repo-file-table";
import { RepoPathCommitRow } from "./repo-path-commit-row";
import { RepoPathNotFound } from "./repo-path-not-found";
import { directoryBrowsePrevious } from "./repo-previous-data";

interface RepoPathBrowseProps {
    owner: string;
    repo: string;
    provider: Provider;
    reference: RepositoryReference;
    /** Repo-relative directory path; never "" on a directory page. */
    path: string;
    children?: (
        contents: DirectoryEntry[],
        resolvedObjectId: string | null,
    ) => ReactNode;
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
    reference,
    path,
    children,
}: RepoPathBrowseProps) {
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

    const isFile =
        !browseStale &&
        browse?.outcome === "found" &&
        browse.classification.kind !== "directory";

    useEffect(() => {
        if (isFile) {
            router.replace(blobHref(provider, owner, repo, reference, path));
        }
    }, [isFile, router, provider, owner, repo, reference, path]);

    if (!browseStale && browseQuery.error !== null) {
        throw browseQuery.error;
    }

    const pathMissing = !browseStale && browse?.outcome === "missing";
    const contents =
        browse?.outcome === "found" &&
        browse.classification.kind === "directory"
            ? browse.entries
            : [];

    if (pathMissing) {
        return (
            <>
                <RepoBreadcrumb
                    owner={owner}
                    repo={repo}
                    reference={reference}
                    provider={provider}
                    path={path}
                />
                <RepoContentCard>
                    <RepoPathNotFound
                        provider={provider}
                        owner={owner}
                        repo={repo}
                        selectedRef={reference.value}
                    />
                </RepoContentCard>
            </>
        );
    }

    const busy = browseQuery.isPending || browseStale;

    return (
        <>
            <RepoBreadcrumb
                owner={owner}
                repo={repo}
                reference={reference}
                provider={provider}
                path={path}
            />
            <RepoContentCard>
                <RepoBusyBar busy={busy} />
                <RepoPathCommitRow
                    owner={owner}
                    repo={repo}
                    provider={provider}
                    reference={reference}
                    resolvedObjectId={
                        browse?.outcome === "found"
                            ? browse.reference.objectId
                            : null
                    }
                    path={path}
                    view="tree"
                />
                <div className={cn(busy && "pointer-events-none opacity-60")}>
                    {browse === undefined ? (
                        <RepoFileTableSkeleton />
                    ) : contents.length === 0 ? (
                        <div className="p-8 text-center text-sm text-text-tertiary">
                            This directory is empty.
                        </div>
                    ) : (
                        <RepoFileTable
                            owner={owner}
                            repo={repo}
                            provider={provider}
                            reference={reference}
                            entries={contents}
                        />
                    )}
                </div>
            </RepoContentCard>
            {children ? (
                <div className={cn(busy && "pointer-events-none opacity-60")}>
                    {children(
                        contents,
                        browse?.outcome === "found"
                            ? browse.reference.objectId
                            : null,
                    )}
                </div>
            ) : null}
        </>
    );
}
