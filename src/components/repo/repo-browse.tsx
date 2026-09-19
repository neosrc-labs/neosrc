"use client";

import { Fzf } from "fzf";
import { GitBranchIcon, Search, TagIcon, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
    mapChecksListToStatusContexts,
    StatusChecksHoverCard,
} from "~/components/ci-status";
import type { RepoLatestCommit } from "~/server/github";
import type { DirectoryEntry } from "~/server/repository/directory-browse";
import { api } from "~/trpc/react";
import {
    blobHref,
    branchesHref,
    commitsHref,
    type Provider,
    type RepositoryReference,
    repoUrl,
} from "~/utils/provider-url";
import { ClonePopover } from "./clone-popover";
import { ForkSyncRow } from "./fork-sync-row";
import { RefSelector } from "./ref-selector";
import { RepoBreadcrumb } from "./repo-breadcrumb";
import { RepoCommitRow, RepoCommitRowSkeleton } from "./repo-commit-row";
import { RepoContentCard } from "./repo-content-card";

import {
    RepoFileTable,
    RepoFileTableSkeleton,
    RepoSearchResultsTable,
} from "./repo-file-table";
import { RepoPathNotFound } from "./repo-path-not-found";

interface RepoBrowseProps {
    owner: string;
    repo: string;
    provider: Provider;
    /** Branch or tag being listed. Controlled by the caller. */
    reference: RepositoryReference;
    /** Repo-relative directory path; "" is the repo root. */
    path: string;
    onSelectRef: (reference: RepositoryReference) => void;
    isFork?: boolean;
    parentFullName?: string | null;
    parentDefaultBranch?: string | null;
    /** Rendered below the card once the listing resolves. */
    children?: (
        contents: DirectoryEntry[],
        resolvedObjectId: string | null,
    ) => ReactNode;
}

export function RepoBrowse({
    owner,
    repo,
    provider,
    reference,
    path,
    onSelectRef,
    isFork,
    parentFullName,
    parentDefaultBranch,
    children,
}: RepoBrowseProps) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [hasRequestedTree, setHasRequestedTree] = useState(false);

    const browseQuery = api.repos.browseDirectory.useQuery({
        provider,
        owner,
        repo,
        ref: reference.value,
        refKind: reference.kind,
        path,
    });
    const browse = browseQuery.data;
    const contents =
        browse?.outcome === "found" &&
        browse.classification.kind === "directory"
            ? browse.entries
            : [];
    const { data: latestCommit } = api.repos.getLatestCommit.useQuery(
        {
            provider,
            owner,
            repo,
            ref:
                browse?.outcome === "found"
                    ? browse.reference.objectId
                    : reference.value,
        },
        { enabled: browse?.outcome === "found" },
    );

    const isSearchActive = searchQuery.length > 0;
    const pathMissing = browse?.outcome === "missing";
    const isFile =
        browse?.outcome === "found" &&
        browse.classification.kind !== "directory";

    useEffect(() => {
        if (isFile) {
            router.replace(blobHref(provider, owner, repo, reference, path));
        }
    }, [isFile, router, provider, owner, repo, reference, path]);

    const { data: fileTree } = api.repos.getFileTree.useQuery(
        {
            provider,
            owner,
            repo,
            ref: reference.value,
            refKind: reference.kind,
        },
        { enabled: hasRequestedTree },
    );

    const searchResults = useMemo(() => {
        if (!fileTree || !isSearchActive || !searchQuery) return null;

        const fzf = new Fzf(fileTree, {
            selector: (item) => item.path,
            limit: 50,
        });

        return fzf.find(searchQuery).map((result) => result.item);
    }, [fileTree, searchQuery, isSearchActive]);

    if (browseQuery.error !== null) {
        throw browseQuery.error;
    }

    return (
        <>
            <RepoContentCard>
                <FileTableHeader
                    owner={owner}
                    repo={repo}
                    provider={provider}
                    reference={reference}
                    setReference={onSelectRef}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    setHasRequestedTree={setHasRequestedTree}
                />
                <div>
                    {isSearchActive ? (
                        !searchResults?.length ? (
                            <div className="p-8 text-center text-sm text-text-tertiary">
                                No files matching &quot;{searchQuery}&quot;
                            </div>
                        ) : (
                            <RepoSearchResultsTable
                                searchResults={searchResults}
                                owner={owner}
                                repo={repo}
                                provider={provider}
                                reference={reference}
                            />
                        )
                    ) : (
                        <>
                            <RepoBreadcrumb
                                owner={owner}
                                repo={repo}
                                reference={reference}
                                provider={provider}
                                path={path}
                            />
                            <ListingCommitRow
                                owner={owner}
                                repo={repo}
                                provider={provider}
                                reference={reference}
                                latestCommit={latestCommit}
                            />
                            {browseQuery.isPending ? (
                                <RepoFileTableSkeleton />
                            ) : pathMissing ? (
                                <RepoPathNotFound
                                    provider={provider}
                                    owner={owner}
                                    repo={repo}
                                    selectedRef={reference.value}
                                />
                            ) : contents.length === 0 ? (
                                <div className="p-8 text-center text-sm text-text-tertiary">
                                    This directory is empty.
                                </div>
                            ) : (
                                <>
                                    {isFork &&
                                        parentFullName &&
                                        parentDefaultBranch &&
                                        provider !== "cb" && (
                                            <ForkSyncRow
                                                owner={owner}
                                                repo={repo}
                                                parentFullName={parentFullName}
                                                defaultBranch={reference.value}
                                                parentDefaultBranch={
                                                    parentDefaultBranch
                                                }
                                            />
                                        )}
                                    <RepoFileTable
                                        owner={owner}
                                        repo={repo}
                                        provider={provider}
                                        reference={reference}
                                        entries={contents}
                                    />
                                </>
                            )}
                        </>
                    )}
                </div>
            </RepoContentCard>
            {children?.(
                contents,
                browse?.outcome === "found" ? browse.reference.objectId : null,
            )}
        </>
    );
}

interface RepoBrowseRootProps {
    owner: string;
    repo: string;
    provider: Provider;
    defaultBranch: string;
    isFork: boolean;
    parentFullName: string | null;
    parentDefaultBranch: string | null;
}

/**
 * Repo-root browser that owns the listed ref, for pages whose URL carries no
 * branch. The tree page drives `RepoBrowse` from the URL instead.
 */
export function RepoBrowseRoot({
    owner,
    repo,
    provider,
    defaultBranch,
    isFork,
    parentFullName,
    parentDefaultBranch,
}: RepoBrowseRootProps) {
    const [reference, setReference] = useState<RepositoryReference>(() => ({
        kind: "branch",
        value: defaultBranch,
    }));

    useEffect(() => {
        setReference({ kind: "branch", value: defaultBranch });
    }, [defaultBranch]);

    return (
        <RepoBrowse
            owner={owner}
            repo={repo}
            provider={provider}
            reference={reference}
            path=""
            onSelectRef={setReference}
            isFork={isFork}
            parentFullName={parentFullName}
            parentDefaultBranch={parentDefaultBranch}
        />
    );
}

interface RepoBrowseSkeletonProps {
    owner: string;
    repo: string;
    provider: Provider;
}

export function RepoBrowseSkeleton({
    owner,
    repo,
    provider,
}: RepoBrowseSkeletonProps) {
    return (
        <RepoContentCard>
            <FileTableHeaderSkeleton
                owner={owner}
                repo={repo}
                provider={provider}
            />
            <RepoCommitRowSkeleton />
            <RepoFileTableSkeleton />
        </RepoContentCard>
    );
}

function FileTableHeaderSkeleton({
    owner,
    repo,
    provider,
}: {
    owner: string;
    repo: string;
    provider: Provider;
}) {
    return (
        <div className="flex min-h-16 items-center justify-between border-border border-b bg-surface-elevated px-4 py-3">
            <div className="flex items-center gap-2">
                <div className="h-8.5 w-28 animate-pulse rounded-lg border border-border bg-surface-secondary" />
                <BranchAndTagsSkeleton />
            </div>
            <div className="flex items-center gap-2">
                <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
                    <input
                        type="text"
                        disabled
                        placeholder="Search files..."
                        className="h-8 w-48 rounded-md border border-border bg-transparent py-1 pr-7 pl-8 text-sm text-text-primary placeholder-text-tertiary"
                    />
                </div>
                <ClonePopover owner={owner} repo={repo} provider={provider} />
            </div>
        </div>
    );
}

function BranchAndTagsSkeleton() {
    return (
        <span className="inline-flex items-center gap-1">
            <div className="ml-3 h-6 w-26 animate-pulse rounded bg-surface-secondary" />
            <div className="ml-3 h-6 w-20 animate-pulse rounded bg-surface-secondary" />
        </span>
    );
}

function FileTableHeader({
    owner,
    repo,
    provider,
    reference,
    setReference,
    searchQuery,
    setSearchQuery,
    setHasRequestedTree,
}: {
    owner: string;
    repo: string;
    provider: Provider;
    reference: RepositoryReference;
    setReference: (reference: RepositoryReference) => void;
    searchQuery: string;
    setSearchQuery: (b: string) => void;
    setHasRequestedTree: (o: boolean) => void;
}) {
    const searchInputRef = useRef<HTMLInputElement>(null);

    const { data: refCounts } = api.repos.getRefCounts.useQuery({
        provider,
        owner,
        repo,
    });

    return (
        <div className="flex min-h-16 items-center justify-between border-border border-b bg-surface-elevated px-4 py-3">
            <div className="flex items-center gap-2">
                <RefSelector
                    owner={owner}
                    repo={repo}
                    provider={provider}
                    reference={reference}
                    onSelect={setReference}
                />
                {refCounts ? (
                    <span className="inline-flex items-center gap-1 text-sm text-text-tertiary">
                        <a
                            href={branchesHref(provider, owner, repo)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-surface-secondary"
                        >
                            <GitBranchIcon className="h-3 w-3" />
                            <span className="font-semibold text-text-primary">
                                {refCounts.branchCount}
                            </span>{" "}
                            {refCounts.branchCount === 1
                                ? "branch"
                                : "branches"}
                        </a>
                        <a
                            href={`${repoUrl(provider, owner, repo)}/tags`}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-surface-secondary"
                        >
                            <TagIcon className="h-3 w-3" />
                            <span className="font-semibold text-text-primary">
                                {refCounts.tagCount}
                            </span>{" "}
                            {refCounts.tagCount === 1 ? "tag" : "tags"}
                        </a>
                    </span>
                ) : (
                    <BranchAndTagsSkeleton />
                )}
            </div>

            <div className="flex items-center gap-2">
                <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => setHasRequestedTree(true)}
                        placeholder="Search files..."
                        className="h-8 w-48 rounded-md border border-border bg-transparent py-1 pr-7 pl-8 text-sm text-text-primary outline-hidden placeholder:text-text-tertiary focus:border-focus focus:ring-1 focus:ring-focus"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer rounded p-0.5 text-text-tertiary hover:text-text-primary"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                <ClonePopover owner={owner} repo={repo} provider={provider} />
            </div>
        </div>
    );
}

function ListingCommitRow({
    owner,
    repo,
    provider,
    reference,
    latestCommit,
}: {
    owner: string;
    repo: string;
    provider: Provider;
    reference: RepositoryReference;
    latestCommit: RepoLatestCommit | undefined;
}) {
    const { data: checks, isFetching: checksFetching } =
        api.checks.list.useQuery(
            { owner, repo, sha: latestCommit?.sha ?? "" },
            { enabled: !!latestCommit?.sha },
        );

    const statusContexts = useMemo(
        () => (checks ? mapChecksListToStatusContexts(checks) : []),
        [checks],
    );

    const commitCount = latestCommit?.commitCount ?? 0;

    return (
        <RepoCommitRow
            owner={owner}
            repo={repo}
            provider={provider}
            commit={latestCommit ?? null}
            author={latestCommit?.author ?? null}
            historyHref={commitsHref(provider, owner, repo, reference)}
            historyLabel={
                latestCommit
                    ? `${commitCount.toLocaleString()} ${
                          commitCount === 1 ? "commit" : "commits"
                      }`
                    : undefined
            }
            status={
                statusContexts.length > 0 ? (
                    <StatusChecksHoverCard
                        items-center
                        justify-between
                        border-border
                        border-b
                        bg-surface-elevated
                        px-4
                        py-3
                        contexts={statusContexts}
                        className="size-3.5"
                    />
                ) : checksFetching ? (
                    <div className="size-3.5 shrink-0" aria-hidden />
                ) : null
            }
        />
    );
}
