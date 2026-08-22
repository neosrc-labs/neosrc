"use client";

import { Search, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { Async } from "~/components/async";
import { useSidebar } from "~/components/sidebar-context";
import { NavItem, NavMenu } from "~/components/ui/nav-menu";
import { useFiles } from "~/hooks/files";
import type { PullsGetResponseData } from "~/server/github";
import { NULL_PROMISE } from "~/utils/promise";
import { buildFileTree, FileTree, FileTreeSkeleton } from "./file-tree";
import { ReviewThreadsSection } from "./review-threads-section";
import { StackSection } from "./stack-section";

interface LeftSidebarContentSectionProps {
    owner: string;
    repo: string;
    number: number;
    pullRequestPromise: Promise<PullsGetResponseData> | null;
}

export function LeftSidebarContentSection({
    owner,
    repo,
    number,
    pullRequestPromise,
}: LeftSidebarContentSectionProps) {
    const pathname = usePathname();
    const basePath = `/gh/${owner}/${repo}/pull/${number}`;
    const isFilesActive =
        pathname === `${basePath}/changes` ||
        pathname.startsWith(`${basePath}/changes/`);

    const { setRightOpen } = useSidebar();

    useEffect(() => {
        setRightOpen(!isFilesActive);
    }, [isFilesActive, setRightOpen]);

    if (isFilesActive) {
        return (
            <SidebarFileTree
                number={number}
                owner={owner}
                pullRequestPromise={pullRequestPromise}
                repo={repo}
            />
        );
    }

    return (
        <>
            <ReviewThreadsSection owner={owner} repo={repo} number={number} />
            <StackSection owner={owner} repo={repo} prNumber={number} />
        </>
    );
}

interface SidebarFileTreeProps {
    owner: string;
    repo: string;
    number: number;
    pullRequestPromise: Promise<PullsGetResponseData> | null;
}

function SidebarFileTree({
    owner,
    repo,
    number,
    pullRequestPromise,
}: SidebarFileTreeProps) {
    const pathname = usePathname();
    const basePath = `/gh/${owner}/${repo}/pull/${number}`;
    const commitSha = useMemo(() => {
        const match = pathname?.match(/\/changes\/([a-f0-9]{7,40})/);
        return match ? match[1] : undefined;
    }, [pathname]);

    const pullRequest = use(pullRequestPromise ?? NULL_PROMISE);
    const { files, isLoading, error } = useFiles({
        owner,
        repo,
        number,
        commitSha,
    });

    const fileTree = useMemo(() => buildFileTree(files), [files]);

    const filesChanged = commitSha ? files.length : pullRequest?.changed_files;

    const [searchOpen, setSearchOpen] = useState(false);
    const [search, setSearch] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="flex h-full flex-col">
            <div className="mb-2 flex items-center gap-2">
                <h3 className="text-text-primary">
                    Files Changed{" "}
                    {filesChanged ? <span>({filesChanged})</span> : null}
                </h3>
                {searchOpen ? (
                    <div className="flex items-center gap-1">
                        <input
                            ref={inputRef}
                            autoFocus
                            className="h-6 w-32 rounded border border-border-primary bg-surface-secondary px-1.5 text-text-primary text-xs outline-none placeholder:text-text-tertiary"
                            placeholder="Filter files..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onBlur={() => {
                                if (!search) setSearchOpen(false);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                    setSearch("");
                                    setSearchOpen(false);
                                }
                            }}
                        />
                        <button
                            className="flex-shrink-0 cursor-pointer rounded p-1 text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-label"
                            onClick={() => {
                                setSearch("");
                                setSearchOpen(false);
                            }}
                            type="button"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                ) : (
                    <button
                        className="flex-shrink-0 cursor-pointer rounded p-1 text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-label"
                        onClick={() => {
                            setSearchOpen(true);
                            setTimeout(() => inputRef.current?.focus(), 0);
                        }}
                        type="button"
                    >
                        <Search className="h-4 w-4" />
                    </button>
                )}
            </div>
            <div className="min-h-0 flex-1">
                {error && files.length > 0 && (
                    <p className="mb-2 text-amber-600 text-xs dark:text-amber-400">
                        Some files may be missing: the list failed to load.
                    </p>
                )}
                {files.length > 0 ? (
                    <FileTree
                        basePath={basePath}
                        files={fileTree}
                        filter={search || undefined}
                    />
                ) : isLoading ? (
                    <FileTreeSkeleton />
                ) : error ? (
                    <p className="text-sm text-text-tertiary">
                        Couldn&apos;t load files.
                    </p>
                ) : (
                    <p className="text-sm text-text-tertiary">
                        No files changed
                    </p>
                )}
            </div>
        </div>
    );
}

interface SidebarNavMenuProps {
    owner: string;
    repo: string;
    number: number;
    commentCountPromise?: Promise<number | null> | null;
    fileCountPromise?: Promise<number | null> | null;
}

export function SidebarNavMenu({
    owner,
    repo,
    number,
    commentCountPromise,
    fileCountPromise,
}: SidebarNavMenuProps) {
    const pathname = usePathname();
    const basePath = `/gh/${owner}/${repo}/pull/${number}`;
    const isFilesActive =
        pathname === `${basePath}/changes` ||
        pathname.startsWith(`${basePath}/changes/`);
    return (
        <NavMenu>
            <NavItem
                href={basePath}
                isActive={!isFilesActive}
                label="Conversation"
                count={
                    commentCountPromise ? (
                        <Async promise={commentCountPromise}>
                            {(c) => c ?? undefined}
                        </Async>
                    ) : undefined
                }
            />
            <NavItem
                href={`${basePath}/changes`}
                isActive={isFilesActive}
                label="Files Changed"
                count={
                    fileCountPromise ? (
                        <Async promise={fileCountPromise}>
                            {(c) => c ?? undefined}
                        </Async>
                    ) : undefined
                }
            />
        </NavMenu>
    );
}
