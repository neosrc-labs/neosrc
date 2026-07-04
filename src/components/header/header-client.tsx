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
import { Async } from "~/components/async";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useSidebar } from "../sidebar-context";
import { ThemeToggle } from "../ThemeToggle";

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
    currentUserPromise: Promise<{ login: string; avatarUrl: string } | null>;
    repoDataPromise: Promise<HeaderRepoData | null>;
    initialOwner: string | null;
    initialRepo: string | null;
}

const SKELETON_WIDTHS = [48, 56, 72, 52, 60, 44, 64];

export function HeaderClient({
    currentUserPromise,
    repoDataPromise,
    initialOwner,
    initialRepo,
}: HeaderClientProps) {
    const dataPromise = useMemo(
        () => Promise.all([currentUserPromise, repoDataPromise]),
        [currentUserPromise, repoDataPromise],
    );

    const pathname = usePathname();
    const cleanPath = pathname.replace(/^\/(?:gh|cb)(?=\/)/, "");
    const repoMatch = cleanPath.match(/^\/([^/]+)\/([^/]+)/);
    const owner = repoMatch?.[1] ?? "";
    const repo = repoMatch?.[2] ?? "";
    const provider = pathname.startsWith("/cb/") ? "cb" : "gh";

    const { data: clientRepoData } = api.repos.getByOwnerAndRepo.useQuery(
        { provider, owner, repo },
        { enabled: !!owner && !!repo },
    );
    const { data: clientCounts } = api.repos.getCountsByOwnerAndRepo.useQuery(
        { provider, owner, repo },
        { enabled: !!owner && !!repo },
    );

    const clientFetchedData =
        clientRepoData && clientCounts
            ? { ...clientRepoData, ...clientCounts }
            : null;

    const cachedDataRef = useRef<{
        currentUser: { login: string; avatarUrl: string } | null;
        repoData: HeaderRepoData | null;
    } | null>(null);

    return (
        <Async
            promise={dataPromise}
            fallback={
                <HeaderContent
                    currentUser={cachedDataRef.current?.currentUser ?? null}
                    repoData={cachedDataRef.current?.repoData ?? null}
                    clientFetchedData={clientFetchedData}
                    initialOwner={initialOwner}
                    initialRepo={initialRepo}
                />
            }
        >
            {([currentUser, repoData]) => {
                cachedDataRef.current = { currentUser, repoData };
                return (
                    <HeaderContent
                        currentUser={currentUser}
                        repoData={repoData}
                        clientFetchedData={clientFetchedData}
                        initialOwner={initialOwner}
                        initialRepo={initialRepo}
                    />
                );
            }}
        </Async>
    );
}

function HeaderContent({
    currentUser,
    repoData: serverRepoData,
    clientFetchedData,
    initialOwner,
    initialRepo,
}: {
    currentUser: { login: string; avatarUrl: string } | null;
    repoData: HeaderRepoData | null;
    clientFetchedData?: HeaderRepoData | null;
    initialOwner: string | null;
    initialRepo: string | null;
}) {
    const pathname = usePathname();
    // Strip optional /gh or /cb prefix for owner/repo extraction
    const cleanPath = pathname.replace(/^\/(?:gh|cb)(?=\/)/, "");
    const prMatch = cleanPath.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    const pullsMatch = cleanPath.match(/^\/([^/]+)\/([^/]+)\/pulls/);
    const issuesMatch = cleanPath.match(/^\/([^/]+)\/([^/]+)\/issues/);
    const repoMatch = cleanPath.match(/^\/([^/]+)\/([^/]+)/);
    const owner = repoMatch?.[1];
    const repo = repoMatch?.[2];
    const provider = pathname.startsWith("/cb/") ? "cb" : "gh";
    const { isLeftOpen, isRightOpen, toggleLeft, toggleRight } = useSidebar();

    const repoData =
        owner === initialOwner && repo === initialRepo
            ? serverRepoData
            : clientFetchedData;

    const resolvedRepoData = repoData;

    const headerRef = useRef<HTMLDivElement>(null);
    const leftToggleRef = useRef<HTMLButtonElement>(null);
    const rightToggleRef = useRef<HTMLButtonElement>(null);

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

    useEffect(() => {
        const header = headerRef.current;
        if (!prMatch || !header) return;

        const updateTogglePosition = () => {
            const rect = header.getBoundingClientRect();
            const visible = Math.min(rect.height, Math.max(0, rect.bottom));
            if (leftToggleRef.current) {
                leftToggleRef.current.style.top = `${visible}px`;
            }
            if (rightToggleRef.current) {
                rightToggleRef.current.style.top = `${visible}px`;
            }
        };

        updateTogglePosition();
        window.addEventListener("scroll", updateTogglePosition, {
            passive: true,
        });
        return () => window.removeEventListener("scroll", updateTogglePosition);
    }, [prMatch]);

    const showRepoNav = !!owner && !!repo;

    const tabs = useMemo((): Tab[] => {
        if (!resolvedRepoData || !owner || !repo) return [];

        const isPR = !!prMatch;
        const isPulls = !!pullsMatch;
        const isIssues = !!issuesMatch;

        const isCode = cleanPath === `/${owner}/${repo}`;

        const allTabs: Tab[] = [
            {
                label: "Code",
                path:
                    provider === "cb"
                        ? `https://codeberg.org/${owner}/${repo}`
                        : `https://github.com/${owner}/${repo}`,
                show: true,
                isActive: isCode,
                icon: Code2,
            },
            {
                label: "Issues",
                path: `/${provider}/${owner}/${repo}/issues`,
                show: resolvedRepoData.hasIssues ?? true,
                isActive: isIssues,
                icon: CircleDot,
                count: resolvedRepoData.openIssuesCount,
            },
            {
                label: "Pull Requests",
                path: `/${provider}/${owner}/${repo}/pulls`,
                show: true,
                isActive: isPR || isPulls,
                icon: GitPullRequest,
                count: resolvedRepoData.openPullRequestsCount,
            },
            {
                label: "Actions",
                path:
                    provider === "cb"
                        ? `https://codeberg.org/${owner}/${repo}/actions`
                        : `https://github.com/${owner}/${repo}/actions`,
                show: true,
                isActive: false,
                icon: CirclePlay,
            },
            {
                label: "Projects",
                path:
                    provider === "cb"
                        ? `https://codeberg.org/${owner}/${repo}/projects`
                        : `https://github.com/${owner}/${repo}/projects`,
                show: resolvedRepoData.hasProjects ?? false,
                isActive: false,
                icon: Table2,
            },
            {
                label: "Wiki",
                path:
                    provider === "cb"
                        ? `https://codeberg.org/${owner}/${repo}/wiki`
                        : `https://github.com/${owner}/${repo}/wiki`,
                show: resolvedRepoData.hasWiki ?? false,
                isActive: false,
                icon: BookOpen,
            },
            {
                label: "Settings",
                path:
                    provider === "cb"
                        ? `https://codeberg.org/${owner}/${repo}/settings`
                        : `https://github.com/${owner}/${repo}/settings`,
                show: resolvedRepoData.permissions.admin ?? false,
                isActive: false,
                icon: Settings,
            },
        ];

        return allTabs.filter((t) => t.show);
    }, [
        resolvedRepoData,
        owner,
        repo,
        prMatch,
        pullsMatch,
        issuesMatch,
        cleanPath,
        provider,
    ]);

    return (
        <>
            <header
                className="relative z-50 border-gray-200 border-b bg-white dark:border-zinc-800 dark:bg-zinc-950"
                ref={headerRef}
            >
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center gap-3">
                            <a href="/">
                                <img
                                    src="/logo.svg"
                                    alt="Neosrc"
                                    width={32}
                                    height={32}
                                    className="size-8 shrink-0"
                                />
                            </a>
                            {showRepoNav && (
                                <div className="flex items-center gap-1.5">
                                    <a
                                        className="flex shrink-0 items-center"
                                        href={`https://${provider === "cb" ? "codeberg.org" : "github.com"}/${owner}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {resolvedRepoData?.ownerAvatarUrl ? (
                                            <img
                                                src={
                                                    resolvedRepoData.ownerAvatarUrl
                                                }
                                                alt={owner}
                                                className="size-5 rounded-full"
                                            />
                                        ) : (
                                            <div className="size-5 rounded-full bg-gray-200 dark:bg-zinc-700" />
                                        )}
                                    </a>
                                    <a
                                        className="font-medium text-gray-600 text-sm hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                                        href={`https://${provider === "cb" ? "codeberg.org" : "github.com"}/${owner}`}
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
                                        href={`https://${provider === "cb" ? "codeberg.org" : "github.com"}/${owner}/${repo}`}
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
                                            ? `https://${provider === "cb" ? "codeberg.org" : "github.com"}/${prMatch[1]}/${prMatch[2]}/pull/${prMatch[3]}${provider === "gh" ? "?neosrc_exit=1" : ""}`
                                            : issuesMatch
                                              ? `https://${provider === "cb" ? "codeberg.org" : "github.com"}/${owner}/${repo}/issues`
                                              : `https://${provider === "cb" ? "codeberg.org" : "github.com"}/${owner}/${repo}/pulls`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={`Back to ${provider === "cb" ? "Codeberg" : "GitHub"}`}
                                >
                                    {provider === "cb" ? (
                                        <img
                                            src="/logo-codeberg.svg"
                                            alt=""
                                            className="size-[18px] invert dark:invert-0"
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        <svg
                                            viewBox="0 0 24 24"
                                            className="size-[18px] fill-current"
                                            aria-hidden="true"
                                        >
                                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                                        </svg>
                                    )}
                                    <span className="sr-only">
                                        {`Back to ${provider === "cb" ? "Codeberg" : "GitHub"}`}
                                    </span>
                                </a>
                            )}
                            <ThemeToggle />
                            <a
                                className="flex size-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
                                href="/profile"
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
                                              className="h-5 animate-pulse rounded bg-gray-200 dark:bg-zinc-700"
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
                    ref={leftToggleRef}
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
                    ref={rightToggleRef}
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
