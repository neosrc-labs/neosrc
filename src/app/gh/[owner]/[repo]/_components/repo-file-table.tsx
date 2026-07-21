"use client";

import { GitBranchIcon, HistoryIcon, TagIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { UserLink } from "~/components/user-link";
import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/utils";
import iconMapData from "~/utils/iconMap.json";
import { ClonePopover } from "./clone-popover";
import { RefSelector } from "./ref-selector";

const iconMap: Record<string, string> = iconMapData as Record<string, string>;

interface RepoFileTableProps {
    owner: string;
    repo: string;
    defaultBranch: string;
}

export function RepoFileTable({
    owner,
    repo,
    defaultBranch,
}: RepoFileTableProps) {
    const [selectedRef, setSelectedRef] = useState(defaultBranch);

    useEffect(() => {
        setSelectedRef(defaultBranch);
    }, [defaultBranch]);

    const { data: refCounts } = api.repos.getRefCounts.useQuery({
        owner,
        repo,
    });

    const { data: latestCommit } = api.repos.getLatestCommit.useQuery({
        owner,
        repo,
        ref: selectedRef,
    });

    const { data: contents, isLoading: contentsLoading } =
        api.repos.getContents.useQuery({
            owner,
            repo,
            ref: selectedRef,
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
                owner,
                repo,
                ref: selectedRef,
                paths,
            },
            { enabled: paths.length > 0 },
        );

    return (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex items-center justify-between border-border border-b bg-surface-elevated px-4 py-3">
                <div className="flex items-center gap-2">
                    <RefSelector
                        owner={owner}
                        repo={repo}
                        selectedRef={selectedRef}
                        onSelect={setSelectedRef}
                    />
                    {refCounts && (
                        <span className="inline-flex items-center gap-1 text-sm text-text-tertiary">
                            <a
                                href={`https://github.com/${owner}/${repo}/branches`}
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
                                href={`https://github.com/${owner}/${repo}/tags`}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-surface-secondary"
                            >
                                <TagIcon className="h-3 w-3" />
                                <span className="font-semibold text-text-primary">
                                    {refCounts.tagCount}
                                </span>{" "}
                                {refCounts.tagCount === 1 ? "tag" : "tags"}
                            </a>
                        </span>
                    )}
                </div>

                <ClonePopover owner={owner} repo={repo} />
            </div>

            <div>
                {contentsLoading ? (
                    <>
                        <div className="flex items-center gap-3 border-border border-b px-4 py-3">
                            <div className="h-4 w-4 shrink-0 animate-pulse rounded-full bg-surface-secondary" />
                            <div className="h-3 w-24 animate-pulse rounded bg-surface-secondary" />
                            <div className="h-3 flex-1 animate-pulse rounded bg-surface-secondary" />
                            <div className="ml-auto h-3 w-28 animate-pulse rounded bg-surface-secondary" />
                            <div className="h-3 w-16 animate-pulse rounded bg-surface-secondary" />
                        </div>
                        <div className="p-4">
                            <div className="space-y-2">
                                {["f1", "f2", "f3", "f4", "f5"].map((key) => (
                                    <div
                                        key={key}
                                        className="h-9 animate-pulse rounded bg-surface-secondary"
                                    />
                                ))}
                            </div>
                        </div>
                    </>
                ) : sortedContents.length === 0 ? (
                    <div className="p-8 text-center text-sm text-text-tertiary">
                        This directory is empty.
                    </div>
                ) : (
                    <>
                        {latestCommit && (
                            <div className="flex items-center gap-3 border-border border-b px-4 py-3">
                                <div className="[&_img]:h-4 [&_img]:w-4 [&_span]:text-xs">
                                    <UserLink
                                        actor={
                                            latestCommit.author
                                                ? {
                                                      ...latestCommit.author,
                                                      url: `https://github.com/${latestCommit.author.login}`,
                                                  }
                                                : null
                                        }
                                    />
                                </div>
                                <a
                                    href={`https://github.com/${owner}/${repo}/commit/${latestCommit.sha}`}
                                    className="min-w-0 flex-1 truncate text-text-tertiary text-xs hover:text-blue-600"
                                >
                                    {latestCommit.message}
                                </a>
                                <a
                                    href={`https://github.com/${owner}/${repo}/commit/${latestCommit.sha}`}
                                    className="ml-auto shrink-0 pt-px font-mono text-text-tertiary text-xs hover:text-blue-600"
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
                                        {formatRelativeTime(
                                            latestCommit.committedDate,
                                        )}
                                    </span>
                                )}
                                <a
                                    href={`https://github.com/${owner}/${repo}/commits/${selectedRef}`}
                                    className="inline-flex shrink-0 items-center gap-1 text-text-primary text-xs hover:text-blue-600"
                                >
                                    <HistoryIcon className="h-3.5 w-3.5" />
                                    {latestCommit.commitCount.toLocaleString()}{" "}
                                    {latestCommit.commitCount === 1
                                        ? "commit"
                                        : "commits"}
                                </a>
                            </div>
                        )}
                        <table className="w-full">
                            <tbody>
                                {sortedContents.map((item) => {
                                    const isDir = item.type === "dir";
                                    const href = isDir
                                        ? `https://github.com/${owner}/${repo}/tree/${selectedRef}/${item.path}`
                                        : `https://github.com/${owner}/${repo}/blob/${selectedRef}/${item.path}`;
                                    const iconName = isDir
                                        ? "folder"
                                        : getFileIconName(item.name);

                                    const commit =
                                        fileCommits?.[item.path] ?? null;

                                    return (
                                        <tr
                                            key={item.path}
                                            className="transition-colors hover:bg-surface-secondary"
                                        >
                                            <td className="px-4 py-2">
                                                <a
                                                    href={href}
                                                    className="inline-flex items-center gap-2 text-sm text-text-primary hover:text-blue-600"
                                                >
                                                    <img
                                                        alt=""
                                                        className="h-4 w-4 shrink-0"
                                                        src={`/material-icons/${iconName}.svg`}
                                                        onError={(e) => {
                                                            (
                                                                e.target as HTMLImageElement
                                                            ).src = isDir
                                                                ? "/material-icons/folder.svg"
                                                                : "/material-icons/file.svg";
                                                        }}
                                                    />
                                                    <span>{item.name}</span>
                                                </a>
                                            </td>
                                            <td className="px-4 py-2">
                                                {fileCommitsLoading ? (
                                                    <div className="h-3 w-full animate-pulse rounded bg-surface-secondary" />
                                                ) : commit ? (
                                                    <div className="flex items-center gap-2">
                                                        <a
                                                            href={`https://github.com/${owner}/${repo}/commit/${commit.sha}`}
                                                            className="min-w-0 flex-1 truncate text-text-tertiary text-xs hover:text-blue-600"
                                                        >
                                                            {commit.message}
                                                        </a>
                                                        {commit.committedDate && (
                                                            <span
                                                                className="shrink-0 text-text-tertiary text-xs"
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
                    </>
                )}
            </div>
        </div>
    );
}

function getFileIconName(filename: string): string {
    const parts = filename.split(".");
    if (parts.length > 1) {
        const ext = parts.pop()?.toLowerCase();
        return ext ? (iconMap[ext] ?? "file") : "file";
    }
    return "file";
}

export function RepoFileTableSkeleton() {
    return (
        <div className="rounded-xl border border-border bg-surface">
            <div className="flex items-center justify-between border-border border-b bg-surface-elevated px-4 py-3">
                <div className="h-8 w-32 animate-pulse rounded bg-surface-secondary" />
                <div className="h-8 w-20 animate-pulse rounded-lg bg-surface-secondary" />
            </div>
            <div className="flex items-center gap-3 border-border border-b px-4 py-3">
                <div className="h-4 w-4 shrink-0 animate-pulse rounded-full bg-surface-secondary" />
                <div className="h-3 w-24 animate-pulse rounded bg-surface-secondary" />
                <div className="h-3 flex-1 animate-pulse rounded bg-surface-secondary" />
                <div className="ml-auto h-3 w-28 animate-pulse rounded bg-surface-secondary" />
                <div className="h-3 w-16 animate-pulse rounded bg-surface-secondary" />
            </div>
            <div className="p-4">
                <div className="space-y-2">
                    {["f1", "f2", "f3", "f4", "f5"].map((key) => (
                        <div
                            key={key}
                            className="h-9 animate-pulse rounded bg-surface-secondary"
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
