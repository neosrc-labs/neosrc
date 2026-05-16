"use client";

import { usePathname } from "next/navigation";
import { use, useMemo } from "react";
import { CheckHoverCard } from "~/components/check-hover-card";
import { NavItem, NavMenu } from "~/components/ui/nav-menu";
import { useFiles } from "~/hooks/files";
import type { CheckRun, PullsGetResponseData } from "~/server/github";
import { buildFileTree, FileTree, FileTreeSkeleton } from "./file-tree";

interface LeftSidebarContentSectionProps {
    owner: string;
    repo: string;
    number: number;
    checksPromise: Promise<Array<CheckRun>> | null;
    pullRequestPromise: Promise<PullsGetResponseData> | null;
}

export function LeftSidebarContentSection({
    owner,
    repo,
    number,
    checksPromise,
    pullRequestPromise,
}: LeftSidebarContentSectionProps) {
    const pathname = usePathname();
    const basePath = `/${owner}/${repo}/pull/${number}`;
    const isFilesActive =
        pathname === `${basePath}/changes` ||
        pathname.startsWith(`${basePath}/changes/`);

    return isFilesActive ? (
        <SidebarFileTree
            number={number}
            owner={owner}
            pullRequestPromise={pullRequestPromise}
            repo={repo}
        />
    ) : checksPromise ? (
        <Checks checksPromise={checksPromise} />
    ) : null;
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
    // Extract commit SHA from pathname if present
    const commitSha = useMemo(() => {
        const match = pathname?.match(/\/changes\/([a-f0-9]{7,40})/);
        return match ? match[1] : undefined;
    }, [pathname]);

    const pullRequest = use(pullRequestPromise ?? Promise.resolve(null));
    const { files, isLoading } = useFiles({ owner, repo, number, commitSha });

    const fileTree = useMemo(() => buildFileTree(files), [files]);

    const filesChanged = commitSha ? files.length : pullRequest?.changed_files;

    return (
        <>
            <h3 className="mb-2 font-semibold text-gray-900 text-sm dark:text-zinc-100">
                Files Changed{" "}
                {filesChanged ? <span>({filesChanged})</span> : null}
            </h3>
            {isLoading ? (
                <FileTreeSkeleton />
            ) : files.length > 0 ? (
                <FileTree basePath={basePath} files={fileTree} />
            ) : (
                <p className="text-gray-500 text-sm dark:text-zinc-400">
                    No files changed
                </p>
            )}
        </>
    );
}

interface SidebarNavMenuProps {
    owner: string;
    repo: string;
    number: number;
}

export function SidebarNavMenu({ owner, repo, number }: SidebarNavMenuProps) {
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
            />
            <NavItem
                href={`${basePath}/changes`}
                isActive={isFilesActive}
                label="Files Changed"
            />
        </NavMenu>
    );
}

interface ChecksProps {
    checksPromise: Promise<Array<CheckRun>>;
}

function Checks({ checksPromise }: ChecksProps) {
    const checks = use(checksPromise);
    return (
        <>
            <h3 className="mb-2 font-semibold text-gray-900 text-sm dark:text-zinc-100">
                Checks
            </h3>
            {checks && checks.length > 0 ? (
                <div className="max-h-full space-y-2 overflow-y-auto">
                    {checks.map((check) => (
                        <CheckHoverCard
                            check={check}
                            key={check.html_url ?? check.name}
                        >
                            <a
                                className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800"
                                href={check.html_url}
                                rel="noopener noreferrer"
                                target="_blank"
                            >
                                <span className="text-sm">
                                    {check.conclusion === "success" ? (
                                        <span className="text-green-600">
                                            ✓
                                        </span>
                                    ) : check.conclusion === "failure" ? (
                                        <span className="text-red-600">✗</span>
                                    ) : check.status === "in_progress" ? (
                                        <span className="text-gray-400">
                                            ⏳
                                        </span>
                                    ) : (
                                        <span className="text-gray-400">○</span>
                                    )}
                                </span>
                                <span className="truncate text-gray-700 text-sm dark:text-zinc-300">
                                    {check.name}
                                </span>
                            </a>
                        </CheckHoverCard>
                    ))}
                </div>
            ) : (
                <p className="text-gray-500 text-sm dark:text-zinc-400">
                    No checks
                </p>
            )}
        </>
    );
}
