"use client";

import { Fzf } from "fzf";
import { GitBranchIcon, HistoryIcon, Search, TagIcon, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    mapChecksListToStatusContexts,
    StatusChecksHoverCard,
} from "~/components/ci-status";
import { UserLink } from "~/components/user-link";
import type {
    CodeSearchResultItem,
    FileLatestCommit,
    RepoContentItem,
    RepoLatestCommit,
} from "~/server/github";
import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/utils";
import { getFileIconName, getFolderIconName } from "~/utils/icons";
import { ClonePopover } from "./clone-popover";
import { FileTypeIcon } from "./file-type-icon";
import { ForkSyncRow } from "./fork-sync-row";
import { RefSelector } from "./ref-selector";

type Provider = "gh" | "cb";

function repoUrl(provider: Provider, owner: string, repo: string): string {
    return provider === "cb"
        ? `https://codeberg.org/${owner}/${repo}`
        : `https://github.com/${owner}/${repo}`;
}

interface RepoFileTableProps {
    owner: string;
    repo: string;
    provider: Provider;
    defaultBranch: string;
    isFork: boolean;
    parentFullName: string | null;
    parentDefaultBranch: string | null;
}

export function RepoFileTable({
    owner,
    repo,
    provider,
    defaultBranch,
    isFork,
    parentFullName,
    parentDefaultBranch,
}: RepoFileTableProps) {
    const [selectedBranch, setSelectedBranch] = useState(defaultBranch);
    const [searchQuery, setSearchQuery] = useState("");
    const [hasRequestedTree, setHasRequestedTree] = useState(false);

    useEffect(() => {
        setSelectedBranch(defaultBranch);
    }, [defaultBranch]);

    const { data: latestCommit } = api.repos.getLatestCommit.useQuery({
        provider,
        owner,
        repo,
        ref: selectedBranch,
    });

    const { data: contents, isLoading: contentsLoading } =
        api.repos.getContents.useQuery({
            provider,
            owner,
            repo,
            ref: selectedBranch,
        });

    const sortedContents = useMemo(() => {
        if (!contents) return [];
        return [...contents].sort((a, b) => {
            if (a.type === "dir" && b.type !== "dir") return -1;
            if (a.type !== "dir" && b.type === "dir") return 1;
            return a.name.localeCompare(b.name);
        });
    }, [contents]);

    const paths = useMemo(
        () => sortedContents.map((c) => c.path),
        [sortedContents],
    );

    const { data: fileCommits, isLoading: fileCommitsLoading } =
        api.repos.getFileLatestCommits.useQuery(
            {
                provider,
                owner,
                repo,
                ref: selectedBranch,
                paths,
            },
            { enabled: paths.length > 0 },
        );

    const isSearchActive = searchQuery.length > 0;

    const { data: fileTree } = api.repos.getFileTree.useQuery(
        {
            provider,
            owner,
            repo,
            ref: selectedBranch,
        },
        { enabled: hasRequestedTree },
    );

    const searchResults = useMemo(() => {
        if (!fileTree || !isSearchActive || !searchQuery) return null;

        const fzf = new Fzf(fileTree, {
            selector: (item) => item.path,
            limit: 50,
        });

        return fzf.find(searchQuery).map((r) => r.item);
    }, [fileTree, searchQuery, isSearchActive]);

    return (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <FileTableHeader
                owner={owner}
                repo={repo}
                provider={provider}
                selectedBranch={selectedBranch}
                setSelectedBranch={setSelectedBranch}
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
                        <SearchResultsTable searchResults={searchResults} />
                    )
                ) : (
                    <>
                        {latestCommit ? (
                            <CommitRow
                                owner={owner}
                                repo={repo}
                                provider={provider}
                                latestCommit={latestCommit}
                                selectedBranch={selectedBranch}
                            />
                        ) : (
                            <CommitRowSkeleton />
                        )}
                        {contentsLoading || fileCommitsLoading ? (
                            <TableSkeleton />
                        ) : sortedContents.length === 0 ? (
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
                                            defaultBranch={defaultBranch}
                                            parentDefaultBranch={
                                                parentDefaultBranch
                                            }
                                        />
                                    )}
                                <FileTable
                                    owner={owner}
                                    repo={repo}
                                    provider={provider}
                                    selectedBranch={selectedBranch}
                                    sortedContents={sortedContents}
                                    fileCommits={fileCommits}
                                />
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function FileTable({
    owner,
    repo,
    provider,
    selectedBranch,
    sortedContents,
    fileCommits,
}: {
    owner: string;
    repo: string;
    provider: Provider;
    selectedBranch: string;
    sortedContents: RepoContentItem[];
    fileCommits: Record<string, FileLatestCommit | null> | undefined;
}) {
    return (
        <table className="w-full">
            <tbody>
                {sortedContents.map((item) => {
                    const isDir = item.type === "dir";
                    const encodedPath = item.path
                        .split("/")
                        .map(encodeURIComponent)
                        .join("/");
                    const href =
                        provider === "cb"
                            ? `${repoUrl(provider, owner, repo)}/src/branch/${selectedBranch}/${encodedPath}`
                            : isDir
                              ? `${repoUrl(provider, owner, repo)}/tree/${selectedBranch}/${encodedPath}`
                              : `${repoUrl(provider, owner, repo)}/blob/${selectedBranch}/${encodedPath}`;
                    const iconName = isDir
                        ? getFolderIconName(item.name)
                        : getFileIconName(item.name);

                    const commit = fileCommits?.[item.path] ?? null;

                    return (
                        <tr
                            key={item.path}
                            className="h-10 transition-colors hover:bg-surface-secondary"
                        >
                            <td className="px-4 py-2">
                                <a
                                    href={href}
                                    className="flex items-center gap-2 text-sm text-text-primary hover:text-blue-600 dark:hover:text-blue-400"
                                >
                                    <FileTypeIcon
                                        iconName={iconName}
                                        isDir={isDir}
                                    />
                                    <span>{item.name}</span>
                                </a>
                            </td>
                            <td className="px-4 py-2">
                                {commit ? (
                                    <div className="flex items-center gap-2">
                                        <a
                                            href={`${repoUrl(provider, owner, repo)}/commit/${commit.sha}`}
                                            className="min-w-0 flex-1 truncate text-sm text-text-tertiary hover:text-blue-600 dark:hover:text-blue-400"
                                        >
                                            {commit.message}
                                        </a>
                                        {commit.committedDate && (
                                            <span
                                                className="shrink-0 text-sm text-text-tertiary"
                                                title={new Date(
                                                    commit.committedDate,
                                                ).toLocaleString()}
                                            >
                                                {formatRelativeTime(
                                                    commit.committedDate,
                                                )}
                                            </span>
                                        )}
                                    </div>
                                ) : null}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

function SearchResultsTable({
    searchResults,
}: {
    searchResults: CodeSearchResultItem[];
}) {
    return (
        <table className="w-full">
            <tbody>
                {searchResults.map((item) => {
                    const isDir = item.type === "tree";
                    const iconName = isDir
                        ? getFolderIconName(item.name)
                        : getFileIconName(item.name);
                    return (
                        <tr
                            key={item.path}
                            className="transition-colors hover:bg-surface-secondary"
                        >
                            <td className="px-4 py-2">
                                <a
                                    href={item.htmlUrl}
                                    className="inline-flex items-center gap-2 text-sm text-text-primary hover:text-blue-600 dark:hover:text-blue-400"
                                >
                                    <FileTypeIcon
                                        iconName={iconName}
                                        isDir={isDir}
                                    />
                                    <div className="flex flex-col">
                                        <span>{item.name}</span>
                                        <span className="text-text-tertiary text-xs">
                                            {item.path}
                                        </span>
                                    </div>
                                </a>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

interface RepoFileTableSkeletonProps {
    owner: string;
    repo: string;
}

export function RepoFileTableSkeleton({
    owner,
    repo,
}: RepoFileTableSkeletonProps) {
    return (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <FileTableHeaderSkeleton owner={owner} repo={repo} />
            <CommitRowSkeleton />
            <TableSkeleton />
        </div>
    );
}

function FileTableHeaderSkeleton({
    owner,
    repo,
}: {
    owner: string;
    repo: string;
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
                <ClonePopover owner={owner} repo={repo} />
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
    selectedBranch,
    setSelectedBranch,
    searchQuery,
    setSearchQuery,
    setHasRequestedTree,
}: {
    owner: string;
    repo: string;
    provider: Provider;
    selectedBranch: string;
    setSelectedBranch: (b: string) => void;
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
                    selectedRef={selectedBranch}
                    onSelect={setSelectedBranch}
                />
                {refCounts ? (
                    <span className="inline-flex items-center gap-1 text-sm text-text-tertiary">
                        <a
                            href={`${repoUrl(provider, owner, repo)}/branches`}
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
                        className="h-8 w-48 rounded-md border border-border bg-transparent py-1 pr-7 pl-8 text-sm text-text-primary placeholder-text-tertiary focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
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

function CommitRow({
    owner,
    repo,
    provider,
    latestCommit,
    selectedBranch,
}: {
    owner: string;
    repo: string;
    provider: Provider;
    latestCommit: RepoLatestCommit;
    selectedBranch: string;
}) {
    const { data: checks, isFetching: checksFetching } =
        api.checks.list.useQuery(
            { owner, repo, sha: latestCommit?.sha as string },
            { enabled: !!latestCommit?.sha },
        );

    const statusContexts = useMemo(
        () => (checks ? mapChecksListToStatusContexts(checks) : []),
        [checks],
    );
    const baseUrl = repoUrl(provider, owner, repo);
    const commitsHref = `/${provider === "gh" ? "gh" : "cb"}/${owner}/${repo}/commits/${selectedBranch}`;
    return (
        <div className="flex min-h-12 items-center gap-3 border-border border-b px-4 py-3">
            <div className="[&_img]:h-5 [&_img]:w-5 [&_span]:text-sm">
                <UserLink
                    provider={provider}
                    actor={
                        latestCommit.author
                            ? {
                                  ...latestCommit.author,
                                  url:
                                      provider === "cb"
                                          ? `https://codeberg.org/${latestCommit.author.login}`
                                          : `https://github.com/${latestCommit.author.login}`,
                              }
                            : null
                    }
                />
            </div>
            <a
                href={`${baseUrl}/commit/${latestCommit.sha}`}
                className="min-w-0 flex-1 truncate text-sm text-text-tertiary hover:text-blue-600 dark:hover:text-blue-400"
            >
                {latestCommit.message}
            </a>
            {statusContexts.length > 0 ? (
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
            ) : null}
            <a
                href={`${baseUrl}/commit/${latestCommit.sha}`}
                className="ml-auto shrink-0 pt-px font-mono text-text-tertiary text-xs hover:text-blue-600 dark:hover:text-blue-400"
            >
                {latestCommit.sha.slice(0, 7)}
            </a>
            {latestCommit.committedDate && (
                <span
                    className="shrink-0 text-text-tertiary text-xs"
                    title={new Date(
                        latestCommit.committedDate,
                    ).toLocaleString()}
                >
                    {formatRelativeTime(latestCommit.committedDate)}
                </span>
            )}
            <Link
                href={commitsHref}
                className="inline-flex shrink-0 items-center gap-1 text-sm text-text-primary hover:text-blue-600 dark:hover:text-blue-400"
            >
                <HistoryIcon className="h-3.5 w-3.5" />
                {latestCommit.commitCount.toLocaleString()}{" "}
                {latestCommit.commitCount === 1 ? "commit" : "commits"}
            </Link>
        </div>
    );
}

function CommitRowSkeleton() {
    return (
        <div className="flex min-h-12 items-center gap-3 border-border border-b px-4 py-3">
            <div className="h-5 w-24 animate-pulse rounded bg-surface-secondary" />
            <div className="h-5 w-84 animate-pulse rounded bg-surface-secondary" />
            <div className="flex-1" />
            <div className="ml-auto h-5 w-32 animate-pulse rounded bg-surface-secondary" />
            <div className="h-5 w-28 animate-pulse rounded bg-surface-secondary" />
        </div>
    );
}

function TableSkeleton() {
    return (
        <table className="w-full">
            <tbody>
                {[
                    "r1",
                    "r2",
                    "r3",
                    "r4",
                    "r5",
                    "r6",
                    "r7",
                    "r8",
                    "r9",
                    "r10",
                    "r11",
                    "r12",
                ].map((key) => (
                    <tr key={key} className="h-10">
                        <td className="px-4 py-2">
                            <div className="flex items-center gap-15">
                                <div className="h-5 w-44 animate-pulse rounded bg-surface-secondary" />
                                <div className="h-5 w-64 animate-pulse rounded bg-surface-secondary" />
                            </div>
                        </td>
                        <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                                <div className="flex-1" />
                                <div className="h-5 w-24 shrink-0 animate-pulse rounded bg-surface-secondary" />
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
