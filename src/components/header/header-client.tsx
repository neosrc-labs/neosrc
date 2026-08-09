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
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ElementType } from "react";
import { useEffect, useMemo, useRef } from "react";
import { Async } from "~/components/async";
import { GitHubIcon } from "~/components/github-icon";
import { cn, formatCount } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useSidebar } from "../sidebar-context";
import { ThemeToggle } from "../theme-toggle";

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

// Header repo data cache keyed by "provider/owner/repo". The header stays
// mounted across client-side navigations, so this lets revisiting a repo
// render its nav instantly instead of blanking it or showing a skeleton.
const repoDataCache = new Map<string, HeaderRepoData>();

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
    const { data: clientCounts, refetch: refetchCounts } =
        api.repos.getCountsByOwnerAndRepo.useQuery(
            { provider, owner, repo },
            { enabled: !!owner && !!repo },
        );

    const clientFetchedData =
        clientRepoData && clientCounts
            ? { ...clientRepoData, ...clientCounts }
            : null;

    // Refresh the open issues/PR counts on same-repo page transitions so the
    // header counts always reflect the latest state. Cross-repo transitions
    // already fetch fresh counts through the new query key.
    const lastCountsNav = useRef({ pathname, owner, repo, provider });
    useEffect(() => {
        const prev = lastCountsNav.current;
        lastCountsNav.current = { pathname, owner, repo, provider };
        const repoChanged =
            prev.owner !== owner ||
            prev.repo !== repo ||
            prev.provider !== provider;
        if (prev.pathname !== pathname && !repoChanged) {
            void refetchCounts();
        }
    }, [pathname, owner, repo, provider, refetchCounts]);

    const cachedDataRef = useRef<{
        currentUser: { login: string; avatarUrl: string } | null;
        repoData: HeaderRepoData | null;
    } | null>(null);

    return (
        <Async
            promise={dataPromise}
            fallback={
                <HeaderContent
                    isLoading={true}
                    currentUser={cachedDataRef.current?.currentUser ?? null}
                    repoData={cachedDataRef.current?.repoData ?? null}
                    clientFetchedData={clientFetchedData}
                    clientCounts={clientCounts}
                    initialOwner={initialOwner}
                    initialRepo={initialRepo}
                />
            }
        >
            {([currentUser, repoData]) => {
                cachedDataRef.current = { currentUser, repoData };
                return (
                    <HeaderContent
                        isLoading={false}
                        currentUser={currentUser}
                        repoData={repoData}
                        clientFetchedData={clientFetchedData}
                        clientCounts={clientCounts}
                        initialOwner={initialOwner}
                        initialRepo={initialRepo}
                    />
                );
            }}
        </Async>
    );
}

function HeaderContent({
    isLoading,
    currentUser,
    repoData: serverRepoData,
    clientFetchedData,
    clientCounts,
    initialOwner,
    initialRepo,
}: {
    isLoading: boolean;
    currentUser: { login: string; avatarUrl: string } | null;
    repoData: HeaderRepoData | null;
    clientFetchedData?: HeaderRepoData | null;
    clientCounts?: {
        openIssuesCount: number;
        openPullRequestsCount: number;
    } | null;
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

    const cacheKey = owner && repo ? `${provider}/${owner}/${repo}` : null;

    // Repo metadata: the server render covers the repo it was rendered for;
    // client-side navigations fall back to the client fetch, then the cache.
    const baseRepoData =
        owner === initialOwner && repo === initialRepo
            ? serverRepoData
            : cacheKey
              ? (clientFetchedData ?? repoDataCache.get(cacheKey) ?? null)
              : (clientFetchedData ?? null);

    // Counts always come from the freshest client fetch when available, so
    // open issues/PR counts update on every page transition.
    const resolvedRepoData = useMemo(() => {
        if (!baseRepoData) return null;
        return {
            ...baseRepoData,
            openIssuesCount:
                clientCounts?.openIssuesCount ??
                baseRepoData.openIssuesCount ??
                null,
            openPullRequestsCount:
                clientCounts?.openPullRequestsCount ??
                baseRepoData.openPullRequestsCount ??
                null,
        };
    }, [baseRepoData, clientCounts]);

    if (resolvedRepoData && cacheKey) {
        repoDataCache.set(cacheKey, resolvedRepoData);
    }

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

    // Always show the repo nav when loading to minimize the layout shift on repo pages.
    // We optimize for the happy path. 404 pages may have a bit of layout shift but oh well.
    const showRepoNav = !!owner && !!repo && (isLoading || resolvedRepoData);

    const tabs = useMemo((): Tab[] => {
        if (!resolvedRepoData || !owner || !repo) return [];

        const isPR = !!prMatch;
        const isPulls = !!pullsMatch;
        const isIssues = !!issuesMatch;

        const isCode = cleanPath === `/${owner}/${repo}`;

        const allTabs: Tab[] = [
            {
                label: "Code",
                path: `/${provider}/${owner}/${repo}`,
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
                className="relative z-50 border-border-subtle border-b bg-surface"
                ref={headerRef}
            >
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link href="/">
                                <Image
                                    src="/logo.svg"
                                    alt="Neosrc"
                                    width={32}
                                    height={32}
                                    className="size-8 shrink-0"
                                />
                            </Link>
                            {showRepoNav && (
                                <div className="flex items-center gap-1.5">
                                    <a
                                        className="flex shrink-0 items-center"
                                        href={`https://${provider === "cb" ? "codeberg.org" : "github.com"}/${owner}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {resolvedRepoData?.ownerAvatarUrl ? (
                                            <Image
                                                src={
                                                    resolvedRepoData.ownerAvatarUrl
                                                }
                                                alt={owner}
                                                className="size-5 rounded-full"
                                                width={20}
                                                height={20}
                                            />
                                        ) : (
                                            <div className="size-5 rounded-full bg-surface-selected" />
                                        )}
                                    </a>
                                    <a
                                        className="font-medium text-sm text-text-secondary hover:text-text-primary dark:hover:text-zinc-100"
                                        href={`https://${provider === "cb" ? "codeberg.org" : "github.com"}/${owner}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {owner}
                                    </a>
                                    <span className="text-sm text-text-muted">
                                        /
                                    </span>
                                    <a
                                        className="font-medium text-sm text-text-secondary hover:text-text-primary dark:hover:text-zinc-100"
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
                            {!!repoMatch && (
                                <a
                                    className="flex size-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-label dark:hover:text-zinc-200"
                                    href={
                                        prMatch
                                            ? `https://${provider === "cb" ? "codeberg.org" : "github.com"}/${prMatch[1]}/${prMatch[2]}/pull/${prMatch[3]}${provider === "gh" ? "?neosrc_exit=1" : ""}`
                                            : issuesMatch
                                              ? `https://${provider === "cb" ? "codeberg.org" : "github.com"}/${owner}/${repo}/issues`
                                              : pullsMatch
                                                ? `https://${provider === "cb" ? "codeberg.org" : "github.com"}/${owner}/${repo}/pulls`
                                                : `https://${provider === "cb" ? "codeberg.org" : "github.com"}/${owner}/${repo}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={`Back to ${provider === "cb" ? "Codeberg" : "GitHub"}`}
                                >
                                    {provider === "cb" ? (
                                        <Image
                                            src="/logo-codeberg.svg"
                                            alt=""
                                            className="size-[18px] invert dark:invert-0"
                                            width={18}
                                            height={18}
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        <GitHubIcon />
                                    )}
                                    <span className="sr-only">
                                        {`Back to ${provider === "cb" ? "Codeberg" : "GitHub"}`}
                                    </span>
                                </a>
                            )}
                            <ThemeToggle />
                            <Link
                                className="flex size-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-label dark:hover:text-zinc-200"
                                href="/profile"
                            >
                                {currentUser?.avatarUrl ? (
                                    <Image
                                        src={currentUser.avatarUrl}
                                        alt={currentUser.login}
                                        className="size-6 rounded-full"
                                        width={24}
                                        height={24}
                                    />
                                ) : (
                                    <User size={18} />
                                )}
                                <span className="sr-only">
                                    {currentUser?.login ?? "Profile"}
                                </span>
                            </Link>
                        </div>
                    </div>
                </div>

                {showRepoNav && (
                    <nav aria-label="Repository navigation">
                        <div className="flex gap-0 overflow-x-auto px-4 sm:px-6 lg:px-8">
                            {tabs.length > 0
                                ? tabs.map((tab) => {
                                      const className = cn(
                                          "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 font-medium text-sm transition-colors",
                                          tab.isActive
                                              ? "border-blue-500 text-text-primary"
                                              : "border-transparent text-text-secondary hover:border-gray-300 hover:text-text-primary dark:hover:border-zinc-600 dark:hover:text-zinc-100",
                                      );
                                      const children = (
                                          <>
                                              <tab.icon className="size-4" />
                                              {tab.label}
                                              {tab.count != null && (
                                                  <span className="text-text-muted">
                                                      {formatCount(tab.count)}
                                                  </span>
                                              )}
                                          </>
                                      );
                                      return tab.path.startsWith("/") ? (
                                          <Link
                                              key={tab.path}
                                              href={tab.path}
                                              className={className}
                                          >
                                              {children}
                                          </Link>
                                      ) : (
                                          <a
                                              key={tab.path}
                                              href={tab.path}
                                              className={className}
                                          >
                                              {children}
                                          </a>
                                      );
                                  })
                                : SKELETON_WIDTHS.map((w) => (
                                      <div
                                          key={`skeleton-${w}`}
                                          className="flex items-center border-transparent border-b-2 px-3 py-2"
                                          aria-hidden
                                      >
                                          <div
                                              className="h-5 animate-pulse rounded bg-surface-selected"
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
                    className="fixed left-0 z-40 flex h-7 w-7 cursor-pointer items-center justify-center rounded-r-md bg-surface text-text-tertiary shadow-sm transition-colors hover:bg-surface-tertiary hover:text-text-label dark:hover:text-zinc-200"
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
                    className="fixed right-0 z-40 flex h-7 w-7 cursor-pointer items-center justify-center rounded-l-md bg-surface text-text-tertiary shadow-sm transition-colors hover:bg-surface-tertiary hover:text-text-label dark:hover:text-zinc-200"
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
