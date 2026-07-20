"use client";

import { ChevronDownIcon, GitBranchIcon, TagIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "~/trpc/react";
import iconMapData from "~/utils/iconMap.json";
import { ClonePopover } from "./clone-popover";

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

    const { data: branches } = api.repos.getBranches.useQuery({
        owner,
        repo,
    });

    const { data: refCounts } = api.repos.getRefCounts.useQuery({
        owner,
        repo,
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

    return (
        <div className="rounded-xl border border-border bg-surface">
            <div className="flex items-center justify-between border-border border-b px-4 py-3">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-text-primary">
                            <GitBranchIcon className="h-4 w-4 text-text-tertiary" />
                            <select
                                className="appearance-none bg-transparent outline-hidden"
                                value={selectedRef}
                                onChange={(e) => setSelectedRef(e.target.value)}
                            >
                                {branches && branches.length > 0 ? (
                                    branches.map((branch) => (
                                        <option
                                            key={branch.name}
                                            value={branch.name}
                                        >
                                            {branch.name}
                                        </option>
                                    ))
                                ) : (
                                    <option value={defaultBranch}>
                                        {defaultBranch}
                                    </option>
                                )}
                            </select>
                            <ChevronDownIcon className="pointer-events-none absolute right-2 h-3 w-3 text-text-tertiary" />
                        </div>
                    </div>
                    {refCounts && (
                        <span className="inline-flex items-center gap-1 text-sm text-text-tertiary">
                            <a
                                href={`https://github.com/${owner}/${repo}/branches`}
                                rel="noopener noreferrer"
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
                                rel="noopener noreferrer"
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
                    <div className="p-4">
                        <div className="space-y-2">
                            {["f1", "f2", "f3", "f4", "f5"].map((key) => (
                                <div
                                    key={key}
                                    className="h-6 animate-pulse rounded bg-surface-secondary"
                                />
                            ))}
                        </div>
                    </div>
                ) : sortedContents.length === 0 ? (
                    <div className="p-8 text-center text-sm text-text-tertiary">
                        This directory is empty.
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-border border-b">
                                <th className="px-4 py-2 text-left font-medium text-text-tertiary text-xs">
                                    Name
                                </th>
                                <th className="px-4 py-2 text-right font-medium text-text-tertiary text-xs">
                                    Type
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedContents.map((item) => {
                                const isDir = item.type === "dir";
                                const href = isDir
                                    ? `https://github.com/${owner}/${repo}/tree/${selectedRef}/${item.path}`
                                    : `https://github.com/${owner}/${repo}/blob/${selectedRef}/${item.path}`;
                                const iconName = isDir
                                    ? "folder"
                                    : getFileIconName(item.name);

                                return (
                                    <tr
                                        key={item.path}
                                        className="transition-colors hover:bg-surface-secondary"
                                    >
                                        <td className="px-4 py-2">
                                            <a
                                                href={href}
                                                target="_blank"
                                                rel="noopener noreferrer"
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
                                        <td className="px-4 py-2 text-right text-text-tertiary text-xs">
                                            {isDir ? "Directory" : "File"}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
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
            <div className="flex items-center gap-4 border-border border-b px-4 py-3">
                <div className="h-5 w-32 animate-pulse rounded bg-surface-secondary" />
            </div>
            <div className="p-4">
                <div className="space-y-2">
                    {["f1", "f2", "f3", "f4", "f5"].map((key) => (
                        <div
                            key={key}
                            className="h-6 animate-pulse rounded bg-surface-secondary"
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
