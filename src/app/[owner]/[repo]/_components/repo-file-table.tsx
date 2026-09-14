"use client";

import type {
    CodeSearchResultItem,
    FileLatestCommit,
    RepoContentItem,
} from "~/server/github";
import { formatRelativeTime } from "~/utils";
import { getFileIconName, getFolderIconName } from "~/utils/icons";
import {
    blobHref,
    type Provider,
    repoUrl,
    treeHref,
} from "~/utils/provider-url";
import { FileTypeIcon } from "./file-type-icon";

/** Directory listing: name, latest commit message and its date. */
export function RepoFileTable({
    owner,
    repo,
    provider,
    selectedRef,
    sortedContents,
    fileCommits,
}: {
    owner: string;
    repo: string;
    provider: Provider;
    selectedRef: string;
    sortedContents: RepoContentItem[];
    fileCommits: Record<string, FileLatestCommit | null> | undefined;
}) {
    return (
        <table className="w-full">
            <thead>
                <tr className="border-border border-b bg-surface-elevated text-text-tertiary text-xs">
                    <th className="w-2/5 px-4 py-2 text-left font-medium">
                        Name
                    </th>
                    <th className="px-4 py-2 text-left font-medium">
                        Last commit
                    </th>
                    <th className="whitespace-nowrap px-4 py-2 text-right font-medium">
                        Last commit date
                    </th>
                </tr>
            </thead>
            <tbody>
                {sortedContents.map((item) => {
                    const isDir = item.type === "dir";
                    const href = isDir
                        ? treeHref(
                              provider,
                              owner,
                              repo,
                              selectedRef,
                              item.path,
                          )
                        : blobHref(
                              provider,
                              owner,
                              repo,
                              selectedRef,
                              item.path,
                          );
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
                                    <a
                                        href={`${repoUrl(provider, owner, repo)}/commit/${commit.sha}`}
                                        className="block min-w-0 truncate text-sm text-text-tertiary hover:text-blue-600 dark:hover:text-blue-400"
                                    >
                                        {commit.message}
                                    </a>
                                ) : null}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-right">
                                {commit?.committedDate ? (
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
                                ) : null}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

/** Whole-repo file search results, shown in place of the listing. */
export function RepoSearchResultsTable({
    searchResults,
    owner,
    repo,
    provider,
    selectedRef,
}: {
    searchResults: CodeSearchResultItem[];
    owner: string;
    repo: string;
    provider: Provider;
    selectedRef: string;
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
                                    href={
                                        isDir
                                            ? treeHref(
                                                  provider,
                                                  owner,
                                                  repo,
                                                  selectedRef,
                                                  item.path,
                                              )
                                            : blobHref(
                                                  provider,
                                                  owner,
                                                  repo,
                                                  selectedRef,
                                                  item.path,
                                              )
                                    }
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

/** Loading rows matching `RepoFileTable`'s columns. */
export function RepoFileTableSkeleton() {
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
                        <td className="w-2/5 px-4 py-2">
                            <div className="h-5 w-44 animate-pulse rounded bg-surface-secondary" />
                        </td>
                        <td className="px-4 py-2">
                            <div className="h-5 w-64 animate-pulse rounded bg-surface-secondary" />
                        </td>
                        <td className="px-4 py-2">
                            <div className="ml-auto h-5 w-24 animate-pulse rounded bg-surface-secondary" />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
