"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useMemo, useRef, useState } from "react";
import type { PullRequestFile } from "~/server/github";

import iconMapData from "~/utils/iconMap.json";

const iconMap: Record<string, string> = iconMapData as Record<string, string>;

const ITEM_HEIGHT = 30;

export interface FileNode {
    name: string;
    path: string;
    children?: FileNode[];
    isFile?: boolean;
    status?: string;
    additions?: number;
    deletions?: number;
}

interface FlatItem {
    node: FileNode;
    depth: number;
}

function flattenFileTree(
    files: FileNode[],
    collapsedPaths: Set<string>,
): FlatItem[] {
    const result: FlatItem[] = [];

    function walk(nodes: FileNode[], depth: number) {
        for (const node of nodes) {
            result.push({ node, depth });
            if (node.children && !collapsedPaths.has(node.path)) {
                walk(node.children, depth + 1);
            }
        }
    }

    walk(files, 0);
    return result;
}

export function buildFileTree(files: PullRequestFile[]): FileNode[] {
    const root: FileNode[] = [];

    for (const file of files) {
        const parts = file.filename.split("/");
        let currentLevel = root;
        let currentPath = "";

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!part) continue;
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            const isFile = i === parts.length - 1;

            let node = currentLevel.find((n) => n.name === part);
            if (!node) {
                node = {
                    name: part,
                    path: currentPath,
                    children: isFile ? undefined : [],
                    isFile,
                };
                currentLevel.push(node);
            }

            if (isFile) {
                node.status = file.status;
                node.additions = file.additions;
                node.deletions = file.deletions;
            }

            if (!isFile && node.children) {
                currentLevel = node.children;
            }
        }
    }

    return root;
}

export function FileTree({
    files,
    basePath,
}: {
    files: FileNode[];
    basePath: string;
}) {
    const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(
        new Set(),
    );

    const scrollRef = useRef<HTMLDivElement>(null);

    const flatItems = useMemo(
        () => flattenFileTree(files, collapsedPaths),
        [files, collapsedPaths],
    );

    const virtualizer = useVirtualizer({
        count: flatItems.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => ITEM_HEIGHT,
        overscan: 10,
    });

    const toggleFolder = useCallback((path: string) => {
        setCollapsedPaths((prev) => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    }, []);

    return (
        <div ref={scrollRef} className="h-full overflow-y-auto">
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    position: "relative",
                }}
            >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                    const item = flatItems[virtualItem.index];
                    if (!item) return null;
                    return (
                        <div
                            key={item.node.path}
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: `${virtualItem.size}px`,
                                transform: `translateY(${virtualItem.start}px)`,
                            }}
                        >
                            <FileTreeNode
                                basePath={basePath}
                                depth={item.depth}
                                isCollapsed={collapsedPaths.has(item.node.path)}
                                node={item.node}
                                onToggle={toggleFolder}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function FileTreeNode({
    node,
    depth,
    basePath,
    isCollapsed,
    onToggle,
}: {
    node: FileNode;
    depth: number;
    basePath: string;
    isCollapsed: boolean;
    onToggle: (path: string) => void;
}) {
    const paddingLeft = depth * 12 + 8 + (node.isFile ? 8 : 0);
    const fileId = node.path.replace(/\//g, "-");

    const getFileIcon = (filename: string) => {
        const parts = filename.split(".");
        if (parts.length > 1) {
            const ext = parts.pop()?.toLowerCase();
            return ext ? (iconMap[ext] ?? "file") : "file";
        }
        return "file";
    };

    if (node.isFile) {
        const iconName = getFileIcon(node.name);
        const diffTooltip = [
            node.additions ? `+${node.additions}` : "",
            node.deletions ? `-${node.deletions}` : "",
        ]
            .filter(Boolean)
            .join(" ");
        return (
            <a
                className="flex items-center gap-1.5 truncate rounded px-2 py-1 text-gray-700 text-sm transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                href={`${basePath}/files#${fileId}`}
                style={{ paddingLeft: `${paddingLeft}px` }}
            >
                <img
                    alt=""
                    className="h-4 w-4 flex-shrink-0"
                    loading="lazy"
                    src={`/material-icons/${iconName}.svg`}
                />
                <span className="flex-1 truncate">{node.name}</span>
                {node.status === "added" ? (
                    <span
                        className="flex h-3 w-3 flex-shrink-0 items-center justify-center rounded border border-green-500"
                        title={diffTooltip}
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    </span>
                ) : node.status === "modified" ? (
                    <span
                        className="flex h-3 w-3 flex-shrink-0 items-center justify-center rounded border border-orange-500"
                        title={diffTooltip}
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                    </span>
                ) : node.status === "removed" ? (
                    <span
                        className="flex h-3 w-3 flex-shrink-0 items-center justify-center rounded border border-red-500"
                        title={diffTooltip}
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    </span>
                ) : null}
            </a>
        );
    }

    return (
        <button
            className="flex w-full cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-gray-700 text-sm transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
            onClick={() => onToggle(node.path)}
            style={{ paddingLeft: `${paddingLeft}px` }}
            type="button"
        >
            <svg
                className={`h-3 w-3 flex-shrink-0 transition-transform ${isCollapsed ? "-rotate-90" : "rotate-0"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <title>Toggle folder</title>
                <path
                    d="M19 9l-7 7-7-7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                />
            </svg>
            <img
                alt=""
                className="h-4 w-4 flex-shrink-0"
                loading="lazy"
                src={`/material-icons/folder${isCollapsed ? "" : "-open"}.svg`}
            />
            <span className="truncate">{node.name}</span>
        </button>
    );
}

export function FileTreeSkeleton() {
    const skeletonItems = [
        { depth: 0, id: "skel-0" },
        { depth: 0, id: "skel-1" },
        { depth: 1, id: "skel-2" },
        { depth: 1, id: "skel-3" },
        { depth: 1, id: "skel-4" },
        { depth: 0, id: "skel-5" },
        { depth: 2, id: "skel-6" },
        { depth: 0, id: "skel-7" },
    ];

    return (
        <div className="space-y-0.5">
            {skeletonItems.map((item) => {
                const paddingLeft = item.depth * 12 + 16;
                return (
                    <div
                        className="flex items-center gap-1.5 rounded px-2 py-2"
                        key={item.id}
                        style={{ paddingLeft: `${paddingLeft}px` }}
                    >
                        <div className="h-4 w-4 flex-shrink-0 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                        <div className="h-4 flex-1 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                    </div>
                );
            })}
        </div>
    );
}
