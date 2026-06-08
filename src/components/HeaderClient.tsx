"use client";

import {
    BookOpen,
    CircleDot,
    CirclePlay,
    Code2,
    GitPullRequest,
    PanelLeftOpen,
    PanelRightClose,
    PanelRightOpen,
    Settings,
    Table2,
    User,
} from "lucide-react";
import { usePathname } from "next/navigation";
import type { ElementType } from "react";
import { useEffect, useMemo, useRef } from "react";
import { cn } from "~/lib/utils";
import { useSidebar } from "./sidebar-context";
import { ThemeToggle } from "./ThemeToggle";

interface Tab {
    label: string;
    path: string;
    show: boolean;
    isActive: boolean;
    icon: ElementType;
    count?: number | null;
}

export interface HeaderRepoData {
    hasIssues: boolean;
    hasWiki: boolean;
    hasProjects: boolean;
    hasDiscussions: boolean;
    isPrivate: boolean;
    permissions: { admin: boolean };
    ownerAvatarUrl: string | null;
    openIssuesCount: number | null;
    openPullRequestsCount: number | null;
}

interface HeaderClientProps {
    currentUser: { login: string; avatarUrl: string } | null;
    repoData: HeaderRepoData | null;
    initialOwner: string | null;
    initialRepo: string | null;
}

const SKELETON_WIDTHS = [48, 56, 72, 52, 60, 44, 64];

export function HeaderClient({
    currentUser,
    repoData: serverRepoData,
    initialOwner,
    initialRepo,
}: HeaderClientProps) {
    const pathname = usePathname();
    const prMatch = pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    const pullsMatch = pathname.match(/^\/([^/]+)\/([^/]+)\/pulls/);
    const issuesMatch = pathname.match(/^\/([^/]+)\/([^/]+)\/issues/);
    const repoMatch = pathname.match(/^\/([^/]+)\/([^/]+)/);
    const owner = repoMatch?.[1];
    const repo = repoMatch?.[2];
    const { isLeftOpen, isRightOpen, toggleLeft, toggleRight } = useSidebar();

    const repoData =
        owner === initialOwner && repo === initialRepo ? serverRepoData : null;

    const headerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const header = headerRef.current;
        if (!header) return;

        const observer = new ResizeObserver(([entry]) => {
            if (entry) {
                const height =
                    entry.borderBoxSize?.[0]?.blockSize ??
                    entry.contentRect.height;
                document.documentElement.style.setProperty(
                    "--header-height",
                    `${height}px`,
                );
            }
        });

        observer.observe(header);
        return () => observer.disconnect();
    }, []);

    const showRepoNav = !!owner && !!repo;

    const tabs = useMemo((): Tab[] => {
        if (!repoData || !owner || !repo) return [];

        const isPR = !!prMatch;
        const isPulls = !!pullsMatch;
        const isIssues = !!issuesMatch;

        const isCode = pathname === `/${owner}/${repo}`;

        const allTabs: Tab[] = [
            {
                label: "Code",
                path: `https://github.com/${owner}/${repo}`,
                show: true,
                isActive: isCode,
                icon: Code2,
            },
            {
                label: "Issues",
                path: `/${owner}/${repo}/issues`,
                show: repoData.hasIssues ?? true,
                isActive: isIssues,
                icon: CircleDot,
                count: repoData.openIssuesCount,
            },
            {
                label: "Pull Requests",
                path: `/${owner}/${repo}/pulls`,
                show: true,
                isActive: isPR || isPulls,
                icon: GitPullRequest,
                count: repoData.openPullRequestsCount,
            },
            {
                label: "Actions",
                path: `https://github.com/${owner}/${repo}/actions`,
                show: true,
                isActive: false,
                icon: CirclePlay,
            },
            {
                label: "Projects",
                path: `https://github.com/${owner}/${repo}/projects`,
                show: repoData.hasProjects ?? false,
                isActive: false,
                icon: Table2,
            },
            {
                label: "Wiki",
                path: `https://github.com/${owner}/${repo}/wiki`,
                show: repoData.hasWiki ?? false,
                isActive: false,
                icon: BookOpen,
            },
            {
                label: "Settings",
                path: `https://github.com/${owner}/${repo}/settings`,
                show: repoData.permissions.admin ?? false,
                isActive: false,
                icon: Settings,
            },
        ];

        return allTabs.filter((t) => t.show);
    }, [repoData, owner, repo, prMatch, pullsMatch, issuesMatch, pathname]);

    return (
        <>
            <header
                className="sticky top-0 z-50 border-gray-200 border-b bg-white dark:border-zinc-800 dark:bg-zinc-950"
                ref={headerRef}
            >
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center gap-3">
                            <img
                                src="/logo.svg"
                                alt="Neosrc"
                                width={32}
                                height={32}
                                className="size-8 shrink-0"
                            />
                            {showRepoNav && (
                                <div className="flex items-center gap-1.5">
                                    <a
                                        className="flex shrink-0 items-center"
                                        href={`https://github.com/${owner}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {repoData?.ownerAvatarUrl ? (
                                            <img
                                                src={repoData.ownerAvatarUrl}
                                                alt={owner}
                                                className="size-5 rounded-full"
                                            />
                                        ) : (
                                            <div className="size-5 rounded-full bg-gray-200 dark:bg-zinc-700" />
                                        )}
                                    </a>
                                    <a
                                        className="font-medium text-gray-600 text-sm hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                                        href={`https://github.com/${owner}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {owner}
                                    </a>
                                    <span className="text-gray-400 text-sm dark:text-gray-500">
                                        /
                                    </span>
                                    <a
                                        className="font-medium text-gray-600 text-sm hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                                        href={`https://github.com/${owner}/${repo}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {repo}
                                    </a>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-1">
                            {(prMatch ?? pullsMatch ?? issuesMatch) && (
                                <a
                                    className="flex size-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
                                    href={
                                        prMatch
                                            ? `https://github.com/${prMatch[1]}/${prMatch[2]}/pull/${prMatch[3]}?neosrc_exit=1`
                                            : issuesMatch
                                              ? `https://github.com/${owner}/${repo}/issues`
                                              : `https://github.com/${owner}/${repo}/pulls`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Back to GitHub"
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        className="size-[18px] fill-current"
                                        aria-hidden="true"
                                    >
                                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                                    </svg>
                                    <span className="sr-only">
                                        Back to GitHub
                                    </span>
                                </a>
                            )}
                            <ThemeToggle />
                            <a
                                className="flex size-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
                                href={
                                    currentUser?.login
                                        ? `https://github.com/${currentUser.login}`
                                        : undefined
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {currentUser?.avatarUrl ? (
                                    <img
                                        src={currentUser.avatarUrl}
                                        alt={currentUser.login}
                                        className="size-6 rounded-full"
                                    />
                                ) : (
                                    <User size={18} />
                                )}
                                <span className="sr-only">
                                    {currentUser?.login ?? "Profile"}
                                </span>
                            </a>
                        </div>
                    </div>
                </div>

                {showRepoNav && (
                    <nav aria-label="Repository navigation">
                        <div className="flex gap-0 overflow-x-auto px-4 sm:px-6 lg:px-8">
                            {tabs.length > 0
                                ? tabs.map((tab) => (
                                      <a
                                          key={tab.path}
                                          href={tab.path}
                                          className={cn(
                                              "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 font-medium text-sm transition-colors",
                                              tab.isActive
                                                  ? "border-blue-500 text-gray-900 dark:text-gray-100"
                                                  : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:border-zinc-600 dark:hover:text-gray-100",
                                          )}
                                      >
                                          <tab.icon className="size-4" />
                                          {tab.label}
                                          {tab.count != null && (
                                              <span className="text-gray-400 dark:text-gray-500">
                                                  {tab.count.toLocaleString()}
                                              </span>
                                          )}
                                      </a>
                                  ))
                                : SKELETON_WIDTHS.map((w) => (
                                      <div
                                          key={`skeleton-${w}`}
                                          className="flex items-center border-transparent border-b-2 px-3 py-2"
                                          aria-hidden
                                      >
                                          <div
                                              className="h-4 animate-pulse rounded bg-gray-200 dark:bg-zinc-700"
                                              style={{ width: `${w}px` }}
                                          />
                                      </div>
                                  ))}
                        </div>
                    </nav>
                )}
            </header>

            {prMatch && !isLeftOpen && (
                <button
                    className="fixed left-0 z-40 flex h-7 w-7 cursor-pointer items-center justify-center rounded-r-md bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-100 hover:text-gray-700 dark:bg-zinc-950 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
                    style={{ top: "var(--header-height)" }}
                    onClick={toggleLeft}
                    title="Open left sidebar"
                    type="button"
                >
                    <PanelLeftOpen size={16} />
                </button>
            )}

            {prMatch && (
                <button
                    className="fixed right-0 z-40 flex h-7 w-7 cursor-pointer items-center justify-center rounded-l-md bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-100 hover:text-gray-700 dark:bg-zinc-950 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
                    style={{ top: "var(--header-height)" }}
                    onClick={toggleRight}
                    title={
                        isRightOpen
                            ? "Close right sidebar"
                            : "Open right sidebar"
                    }
                    type="button"
                >
                    {isRightOpen ? (
                        <PanelRightClose size={16} />
                    ) : (
                        <PanelRightOpen size={16} />
                    )}
                </button>
            )}
        </>
    );
}
