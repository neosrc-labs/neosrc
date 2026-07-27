"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { SquareDot } from "lucide-react";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
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

    return compressTree(root);
}

export function compressTree(nodes: FileNode[]): FileNode[] {
    return nodes.map((node) => {
        if (node.isFile || !node.children) return node;

        const children = compressTree(node.children);

        const onlyChild = children[0];
        if (children.length === 1 && onlyChild && !onlyChild.isFile) {
            return {
                name: `${node.name}/${onlyChild.name}`,
                path: onlyChild.path,
                children: onlyChild.children,
                isFile: false,
            };
        }

        return { ...node, children };
    });
}

export function pruneTree(nodes: FileNode[], search: string): FileNode[] {
    const lowerSearch = search.toLowerCase();

    function hasMatch(node: FileNode): boolean {
        if (node.path.toLowerCase().includes(lowerSearch)) return true;
        return node.children?.some(hasMatch) ?? false;
    }

    function prune(node: FileNode): FileNode | null {
        if (!hasMatch(node)) return null;
        if (!node.children || node.children.length === 0) return node;
        const children = node.children
            .map(prune)
            .filter((c): c is FileNode => c !== null);
        return { ...node, children };
    }

    return nodes.map(prune).filter((n): n is FileNode => n !== null);
}

function highlightMatch(text: string, query: string): ReactNode {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    const fullIdx = lowerText.indexOf(lowerQuery);
    if (fullIdx !== -1) {
        return (
            <>
                {text.slice(0, fullIdx)}
                <mark className="rounded-sm bg-yellow-500/20 text-inherit">
                    {text.slice(fullIdx, fullIdx + query.length)}
                </mark>
                {text.slice(fullIdx + query.length)}
            </>
        );
    }

    if (!query.includes("/")) return text;

    type Match = { start: number; end: number };
    const matches: Match[] = [];

    for (const segment of query.split("/")) {
        if (!segment) continue;
        const lowerSegment = segment.toLowerCase();
        let searchFrom = 0;
        while (true) {
            const idx = lowerText.indexOf(lowerSegment, searchFrom);
            if (idx === -1) break;
            matches.push({ start: idx, end: idx + segment.length });
            searchFrom = idx + segment.length;
        }
    }

    if (matches.length === 0) return text;

    matches.sort((a, b) => a.start - b.start);

    const merged: Match[] = [];

    for (const match of matches) {
        const last = merged.length > 0 ? merged[merged.length - 1] : null;
        if (last && match.start <= last.end + 1) {
            last.end = Math.max(last.end, match.end);
        } else {
            merged.push(match);
        }
    }

    let lastEnd = 0;
    const parts: ReactNode[] = [];

    for (const match of merged) {
        if (match.start < lastEnd) continue;
        if (match.start > lastEnd) {
            parts.push(text.slice(lastEnd, match.start));
        }
        parts.push(
            <mark
                key={match.start}
                className="rounded-sm bg-yellow-500/20 text-inherit"
            >
                {text.slice(match.start, match.end)}
            </mark>,
        );
        lastEnd = match.end;
    }

    if (lastEnd < text.length) {
        parts.push(text.slice(lastEnd));
    }

    return parts;
}

export function FileTree({
    files,
    basePath,
    filter,
}: {
    files: FileNode[];
    basePath: string;
    filter?: string;
}) {
    const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(
        new Set(),
    );

    const scrollRef = useRef<HTMLDivElement>(null);

    const displayFiles = useMemo(
        () => (filter ? pruneTree(files, filter) : files),
        [files, filter],
    );

    const flatItems = useMemo(
        () =>
            flattenFileTree(displayFiles, filter ? new Set() : collapsedPaths),
        [displayFiles, collapsedPaths, filter],
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
                                filter={filter}
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
    filter,
    isCollapsed,
    onToggle,
}: {
    node: FileNode;
    depth: number;
    basePath: string;
    filter?: string;
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
                className="flex items-center gap-1.5 truncate rounded px-2 py-1 text-sm text-text-label transition-colors hover:bg-surface-tertiary"
                href={`${basePath}/files#${fileId}`}
                style={{ paddingLeft: `${paddingLeft}px` }}
            >
                <img
                    alt=""
                    className="h-4 w-4 flex-shrink-0"
                    loading="lazy"
                    src={`/material-icons/${iconName}.svg`}
                    onError={(e) => {
                        (e.target as HTMLImageElement).src =
                            "/material-icons/file.svg";
                    }}
                />
                <span className="flex-1 truncate">
                    {filter ? highlightMatch(node.name, filter) : node.name}
                </span>
                {node.status === "added" ? (
                    <span className="flex-shrink-0" title={diffTooltip}>
                        <SquareDot className="h-3 w-3 text-green-500" />
                    </span>
                ) : node.status === "modified" ? (
                    <span className="flex-shrink-0" title={diffTooltip}>
                        <SquareDot className="h-3 w-3 text-orange-500" />
                    </span>
                ) : node.status === "removed" ? (
                    <span className="flex-shrink-0" title={diffTooltip}>
                        <SquareDot className="h-3 w-3 text-red-500" />
                    </span>
                ) : null}
            </a>
        );
    }

    return (
        <button
            className="flex w-full cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm text-text-label transition-colors hover:bg-surface-tertiary"
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
            <span className="truncate">
                {filter ? highlightMatch(node.name, filter) : node.name}
            </span>
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
                        <div className="h-4 w-4 flex-shrink-0 animate-pulse rounded bg-surface-selected" />
                        <div className="h-4 flex-1 animate-pulse rounded bg-surface-selected" />
                    </div>
                );
            })}
        </div>
    );
}
