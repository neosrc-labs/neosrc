"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import type { PullRequestFile } from "~/server/github";
import { cn } from "~/utils/helpers";
import { getFileIconName, getFolderIconName } from "~/utils/icons";

const ITEM_HEIGHT = 30;

export interface FileNode {
    name: string;
    path: string;
    children?: FileNode[];
    isFile?: boolean;
    status?: string;
    additions?: number;
    deletions?: number;
    /** Placeholder row while a directory's children load. */
    isLoading?: boolean;
    /** Placeholder row for a directory whose children failed to load. */
    isFailed?: boolean;
}

interface FlatItem {
    node: FileNode;
    depth: number;
}

function flattenFileTree(
    files: FileNode[],
    isExpanded: (path: string) => boolean,
): FlatItem[] {
    const result: FlatItem[] = [];

    function walk(nodes: FileNode[], depth: number) {
        for (const node of nodes) {
            result.push({ node, depth });
            if (node.children && isExpanded(node.path)) {
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

export function highlightMatch(text: string, query: string): ReactNode {
    if (!query) return text;

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    const fullIdx = lowerText.indexOf(lowerQuery);
    if (fullIdx !== -1) {
        return (
            <>
                {text.slice(0, fullIdx)}
                <mark className="rounded-sm bg-warning-border/30 text-inherit">
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
                className="rounded-sm bg-warning-border/30 text-inherit"
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

interface FileTreeProps {
    nodes: FileNode[];
    /** Whether a directory's children are listed. */
    isExpanded: (path: string) => boolean;
    onToggle: (path: string) => void;
    /** Link target for a file node. */
    fileHref: (node: FileNode) => string;
    /**
     * How file rows navigate: "route" renders next/link so the rail keeps its
     * state, "anchor" renders a plain <a> for same-page diff anchors.
     */
    fileLink: "route" | "anchor";
    /** When set, a directory's name links here; the chevron still toggles. */
    dirHref?: (node: FileNode) => string;
    /** Row rendered as the current location; scrolled into view when it changes. */
    activePath?: string;
    filter?: string;
}

export function FileTree({
    nodes,
    isExpanded,
    onToggle,
    fileHref,
    fileLink,
    dirHref,
    activePath,
    filter,
}: FileTreeProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    const displayFiles = useMemo(
        () => (filter ? pruneTree(nodes, filter) : nodes),
        [nodes, filter],
    );

    const flatItems = useMemo(
        () => flattenFileTree(displayFiles, filter ? () => true : isExpanded),
        [displayFiles, isExpanded, filter],
    );

    const virtualizer = useVirtualizer({
        count: flatItems.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => ITEM_HEIGHT,
        overscan: 10,
    });

    const activeIndex = useMemo(
        () =>
            activePath
                ? flatItems.findIndex((item) => item.node.path === activePath)
                : -1,
        [flatItems, activePath],
    );

    useEffect(() => {
        if (activeIndex >= 0) {
            virtualizer.scrollToIndex(activeIndex, { align: "auto" });
        }
    }, [activeIndex, virtualizer]);

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
                                activePath={activePath}
                                depth={item.depth}
                                dirHref={dirHref}
                                fileHref={fileHref}
                                fileLink={fileLink}
                                filter={filter}
                                isExpanded={isExpanded(item.node.path)}
                                node={item.node}
                                onToggle={onToggle}
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
    isExpanded,
    onToggle,
    fileHref,
    fileLink,
    dirHref,
    filter,
    activePath,
}: {
    node: FileNode;
    depth: number;
    isExpanded: boolean;
    onToggle: (path: string) => void;
    fileHref: (node: FileNode) => string;
    fileLink: "route" | "anchor";
    dirHref?: (node: FileNode) => string;
    filter?: string;
    activePath?: string;
}) {
    const paddingLeft = depth * 12 + 8 + (node.isFile ? 8 : 0);
    const isActive = activePath === node.path;

    if (node.isLoading) {
        return (
            <div
                className="flex items-center gap-1.5 rounded px-2 py-1"
                style={{ paddingLeft: `${paddingLeft}px` }}
            >
                <div className="h-4 w-28 animate-pulse rounded bg-surface-secondary" />
            </div>
        );
    }

    if (node.isFailed) {
        return (
            <div
                className="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-text-tertiary"
                style={{ paddingLeft: `${paddingLeft}px` }}
            >
                <span className="truncate">{node.name}</span>
            </div>
        );
    }

    if (node.isFile) {
        const iconName = getFileIconName(node.name);
        const diffTooltip = [
            node.additions ? `+${node.additions}` : "",
            node.deletions ? `-${node.deletions}` : "",
        ]
            .filter(Boolean)
            .join(" ");
        let statusClass: string | undefined;
        if (node.status === "added") {
            statusClass = "text-success-emphasis";
        } else if (node.status === "modified") {
            statusClass = "text-warning-emphasis";
        } else if (node.status === "removed") {
            statusClass = "text-danger-emphasis";
        }
        const rowClass = cn(
            "flex items-center gap-1.5 truncate rounded px-2 py-1 text-sm text-text-label transition-colors hover:bg-surface-tertiary",
            isActive && "bg-surface-secondary",
        );
        const content = (
            <>
                <Image
                    alt=""
                    className="h-4 w-4 flex-shrink-0"
                    loading="lazy"
                    src={`/material-icons/${iconName}.svg`}
                    width={16}
                    height={16}
                    onError={(e) => {
                        (e.target as HTMLImageElement).src =
                            "/material-icons/file.svg";
                    }}
                />
                <span
                    className={cn("flex-1 truncate", statusClass)}
                    title={diffTooltip}
                >
                    {filter ? highlightMatch(node.name, filter) : node.name}
                </span>
            </>
        );

        if (fileLink === "route") {
            return (
                <Link
                    className={rowClass}
                    href={fileHref(node)}
                    prefetch={false}
                    style={{ paddingLeft: `${paddingLeft}px` }}
                >
                    {content}
                </Link>
            );
        }

        return (
            <a
                className={rowClass}
                href={fileHref(node)}
                style={{ paddingLeft: `${paddingLeft}px` }}
            >
                {content}
            </a>
        );
    }

    const folderIcon = (
        <Image
            alt=""
            className="h-4 w-4 flex-shrink-0"
            loading="lazy"
            src={`/material-icons/${getFolderIconName(node.name, isExpanded)}.svg`}
            width={16}
            height={16}
            onError={(e) => {
                (e.target as HTMLImageElement).src = `/material-icons/folder${
                    isExpanded ? "-open" : ""
                }.svg`;
            }}
        />
    );

    const label = filter ? highlightMatch(node.name, filter) : node.name;

    if (!dirHref) {
        return (
            <button
                className={cn(
                    "flex w-full cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm text-text-label transition-colors hover:bg-surface-tertiary",
                    isActive && "bg-surface-secondary",
                )}
                onClick={() => onToggle(node.path)}
                style={{ paddingLeft: `${paddingLeft}px` }}
                type="button"
            >
                <ChevronIcon isExpanded={isExpanded} />
                {folderIcon}
                <span className="truncate">{label}</span>
            </button>
        );
    }

    return (
        <div
            className={cn(
                "flex items-center gap-1.5 rounded px-2 py-1 text-sm text-text-label transition-colors hover:bg-surface-tertiary",
                isActive && "bg-surface-secondary",
            )}
            style={{ paddingLeft: `${paddingLeft}px` }}
        >
            <button
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.name}`}
                className="flex-shrink-0 cursor-pointer rounded p-0.5 transition-colors hover:bg-surface-tertiary"
                onClick={() => onToggle(node.path)}
                type="button"
            >
                <ChevronIcon isExpanded={isExpanded} />
            </button>
            <Link
                className="flex min-w-0 flex-1 items-center gap-1.5"
                href={dirHref(node)}
            >
                {folderIcon}
                <span className="truncate">{label}</span>
            </Link>
        </div>
    );
}

function ChevronIcon({ isExpanded }: { isExpanded: boolean }) {
    return (
        <svg
            className={`h-3 w-3 flex-shrink-0 transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`}
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
