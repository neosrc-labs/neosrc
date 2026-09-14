"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    type FileNode,
    FileTree,
    FileTreeSkeleton,
} from "~/components/file-tree";
import type { RepoContentItem } from "~/server/github";
import { api } from "~/trpc/react";
import { blobHref, type Provider, treeHref } from "~/utils/provider-url";
import { sortRepoContents } from "./repo-contents";

interface RepoFileTreeProps {
    owner: string;
    repo: string;
    provider: Provider;
    selectedRef: string;
    /** Path the main view shows; its ancestors start expanded and highlighted. */
    path: string;
}

/** Repo-relative paths to expand so `path` itself is visible. */
function expandedFor(path: string): string[] {
    const prefixes = [""];
    let current = "";
    for (const segment of path.split("/").filter(Boolean)) {
        current = current ? `${current}/${segment}` : segment;
        prefixes.push(current);
    }
    return prefixes;
}

/** Nodes for one listing; expanded directories carry their loaded children. */
function toNodes(
    dirPath: string,
    listings: Record<string, RepoContentItem[]>,
    isExpanded: (path: string) => boolean,
): FileNode[] {
    const rows = listings[dirPath];
    if (!rows) return [];
    return rows.map((row) => {
        if (row.type !== "dir") {
            return { name: row.name, path: row.path, isFile: true };
        }
        if (!isExpanded(row.path)) {
            return { name: row.name, path: row.path, isFile: false };
        }
        const loaded = listings[row.path];
        return {
            name: row.name,
            path: row.path,
            isFile: false,
            children: loaded
                ? toNodes(row.path, listings, isExpanded)
                : [{ name: "Loading...", path: row.path, isLoading: true }],
        };
    });
}

/**
 * File tree beside a tree or blob page. Directories load their children on
 * first expand, so a page view costs one listing per directory opened rather
 * than the repo's whole tree.
 */
export function RepoFileTree({
    owner,
    repo,
    provider,
    selectedRef,
    path,
}: RepoFileTreeProps) {
    const utils = api.useUtils();

    const [expanded, setExpanded] = useState<Set<string>>(
        () => new Set(expandedFor(path)),
    );
    const [listings, setListings] = useState<Record<string, RepoContentItem[]>>(
        {},
    );
    const [failed, setFailed] = useState<Set<string>>(new Set());
    const requested = useRef(new Set<string>());

    // A new ref invalidates every cached listing.
    // biome-ignore lint/correctness/useExhaustiveDependencies: the ref is the trigger, the effect body does not read it
    useEffect(() => {
        requested.current = new Set();
        setListings({});
        setFailed(new Set());
    }, [selectedRef]);

    useEffect(() => {
        setExpanded((previous) => {
            const next = new Set(previous);
            for (const dir of expandedFor(path)) next.add(dir);
            return next;
        });
    }, [path]);

    useEffect(() => {
        for (const dir of expanded) {
            if (requested.current.has(dir)) continue;
            requested.current.add(dir);
            utils.repos.getContents
                .fetch({
                    provider,
                    owner,
                    repo,
                    ref: selectedRef,
                    path: dir || undefined,
                })
                .then((rows) => {
                    setListings((previous) => ({
                        ...previous,
                        [dir]: sortRepoContents(rows),
                    }));
                })
                .catch(() => {
                    setFailed((previous) => new Set(previous).add(dir));
                });
        }
    }, [expanded, utils, provider, owner, repo, selectedRef]);

    const isExpanded = useCallback(
        (nodePath: string) => expanded.has(nodePath),
        [expanded],
    );

    const toggle = useCallback((nodePath: string) => {
        setExpanded((previous) => {
            const next = new Set(previous);
            if (next.has(nodePath)) next.delete(nodePath);
            else next.add(nodePath);
            return next;
        });
    }, []);

    const nodes = useMemo(
        () => toNodes("", listings, isExpanded),
        [listings, isExpanded],
    );

    if (listings[""] === undefined) {
        return failed.has("") ? (
            <p className="p-4 text-sm text-text-tertiary">
                Couldn&apos;t load the file tree.
            </p>
        ) : (
            <FileTreeSkeleton />
        );
    }

    if (listings[""].length === 0) {
        return (
            <p className="p-4 text-sm text-text-tertiary">
                This branch is empty.
            </p>
        );
    }

    return (
        <nav aria-label="File tree" className="flex h-full flex-col px-2 py-3">
            <FileTree
                activePath={path}
                dirHref={(node) =>
                    treeHref(provider, owner, repo, selectedRef, node.path)
                }
                fileHref={(node) =>
                    blobHref(provider, owner, repo, selectedRef, node.path)
                }
                fileLink="route"
                isExpanded={isExpanded}
                nodes={nodes}
                onToggle={toggle}
            />
        </nav>
    );
}
