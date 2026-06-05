"use client";

import { usePathname } from "next/navigation";
import { use, useMemo } from "react";
import { Async } from "~/components/async";
import { NavItem, NavMenu } from "~/components/ui/nav-menu";
import { useFiles } from "~/hooks/files";
import type { PullsGetResponseData } from "~/server/github";
import { buildFileTree, FileTree, FileTreeSkeleton } from "./file-tree";
import { ReviewThreadsSection } from "./review-threads-section";

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
    const basePath = `/${owner}/${repo}/pull/${number}`;
    const isFilesActive =
        pathname === `${basePath}/changes` ||
        pathname.startsWith(`${basePath}/changes/`);

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

    return <ReviewThreadsSection number={number} owner={owner} repo={repo} />;
}

interface SidebarFileTreeProps {
    owner: string;
    repo: string;
    number: number;
    pullRequestPromise: Promise<PullsGetResponseData> | null;
}

export function SidebarFileTree({
    owner,
    repo,
    number,
    pullRequestPromise,
}: SidebarFileTreeProps) {
    const pathname = usePathname();
    const basePath = `/${owner}/${repo}/pull/${number}`;
    const commitSha = useMemo(() => {
        const match = pathname?.match(/\/changes\/([a-f0-9]{7,40})/);
        return match ? match[1] : undefined;
    }, [pathname]);

    const pullRequest = use(pullRequestPromise ?? Promise.resolve(null));
    const { files, isLoading } = useFiles({ owner, repo, number, commitSha });

    const fileTree = useMemo(() => buildFileTree(files), [files]);

    const filesChanged = commitSha ? files.length : pullRequest?.changed_files;

    return (
        <div className="flex h-full flex-col">
            <h3 className="mb-2 font-semibold text-gray-900 text-sm dark:text-zinc-100">
                Files Changed{" "}
                {filesChanged ? <span>({filesChanged})</span> : null}
            </h3>
            <div className="min-h-0 flex-1">
                {isLoading ? (
                    <FileTreeSkeleton />
                ) : files.length > 0 ? (
                    <FileTree basePath={basePath} files={fileTree} />
                ) : (
                    <p className="text-gray-500 text-sm dark:text-zinc-400">
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
}

export function SidebarNavMenu({
    owner,
    repo,
    number,
    commentCountPromise,
}: SidebarNavMenuProps) {
    const pathname = usePathname();
    const basePath = `/${owner}/${repo}/pull/${number}`;
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
            />
        </NavMenu>
    );
}
