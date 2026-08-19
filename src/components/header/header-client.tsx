"use client";

import {
    PanelLeftOpen,
    PanelRightClose,
    PanelRightOpen,
    User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RefObject } from "react";
import { useEffect, useMemo, useRef } from "react";
import { Async } from "~/components/async";
import { CodebergIcon, GitHubIcon } from "~/components/icons";
import { api } from "~/trpc/react";
import { useSidebar } from "../sidebar-context";
import { ThemeToggle } from "../theme-toggle";
import { domain, type Provider, RepoNavbar, useTabs } from "./navbar";
import type { PathType } from "./types";

export interface HeaderRepoData {
    hasIssues: boolean;
    hasWiki: boolean;
    hasProjects: boolean;
    hasDiscussions: boolean;
    isPrivate: boolean;
    permissions: { admin: boolean; write: boolean };
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
    const { provider, owner, repo } = usePathParams();

    const { data: clientRepoData } = api.repos.getByOwnerAndRepo.useQuery(
        { provider, owner: owner as string, repo: repo as string },
        { enabled: !!owner && !!repo },
    );
    const { data: clientCounts, refetch: refetchCounts } =
        api.repos.getCountsByOwnerAndRepo.useQuery(
            { provider, owner: owner as string, repo: repo as string },
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
    const { provider, owner, repo, pullRequestNumber, pathType } =
        usePathParams();

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

    // Always show the repo nav when loading to minimize the layout shift on repo pages.
    // We optimize for the happy path. 404 pages may have a bit of layout shift but oh well.
    const showRepoNav = !!owner && !!repo && (isLoading || resolvedRepoData);

    const tabs = useTabs({
        repoData: resolvedRepoData,
        provider,
        owner: owner ?? null,
        repo: repo ?? null,
        pathType,
    });

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
                                <RepoName
                                    provider={provider}
                                    owner={owner}
                                    repo={repo}
                                    ownerAvatarUrl={
                                        resolvedRepoData?.ownerAvatarUrl
                                    }
                                />
                            )}
                        </div>

                        <div className="flex items-center gap-1">
                            {!!owner && !!repo && !!pathType && (
                                <ProviderIcon
                                    provider={provider}
                                    owner={owner}
                                    repo={repo}
                                    pullRequestNumber={pullRequestNumber}
                                    pathType={pathType}
                                />
                            )}
                            <ThemeToggle />
                            <UserIcon
                                avatarUrl={currentUser?.avatarUrl}
                                login={currentUser?.login}
                            />
                        </div>
                    </div>
                </div>

                {showRepoNav && <RepoNavbar tabs={tabs} />}
            </header>

            {pathType === "PULL_REQUEST" && (
                <PullRequestSidebarToggles headerRef={headerRef} />
            )}
        </>
    );
}

function RepoName({
    provider,
    owner,
    repo,
    ownerAvatarUrl,
}: {
    provider: string;
    owner: string;
    repo: string;
    ownerAvatarUrl?: string | null;
}) {
    return (
        <div className="flex items-center gap-1.5">
            <a
                className="flex shrink-0 items-center"
                href={`https://${provider === "cb" ? "codeberg.org" : "github.com"}/${owner}`}
                target="_blank"
                rel="noopener noreferrer"
            >
                {ownerAvatarUrl ? (
                    <Image
                        src={ownerAvatarUrl}
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
            <span className="text-sm text-text-muted">/</span>
            <a
                className="font-medium text-sm text-text-secondary hover:text-text-primary dark:hover:text-zinc-100"
                href={`https://${provider === "cb" ? "codeberg.org" : "github.com"}/${owner}/${repo}`}
                target="_blank"
                rel="noopener noreferrer"
            >
                {repo}
            </a>
        </div>
    );
}

function ProviderIcon({
    provider,
    owner,
    repo,
    pullRequestNumber,
    pathType,
}: {
    provider: Provider;
    owner: string;
    repo: string;
    pullRequestNumber?: number | null;
    pathType: PathType;
}) {
    return (
        <a
            className="flex size-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-label dark:hover:text-zinc-200"
            href={
                pathType === "PULL_REQUEST"
                    ? `https://${domain(provider)}/${owner}/${repo}/pull/${pullRequestNumber}?neosrc_exit=1`
                    : pathType === "ISSUES_LIST"
                      ? `https://${domain(provider)}/${owner}/${repo}/issues`
                      : pathType === "PULLS_LIST"
                        ? `https://${domain(provider)}/${owner}/${repo}/pulls`
                        : `https://${domain(provider)}/${owner}/${repo}`
            }
            target="_blank"
            rel="noopener noreferrer"
            title={`Back to ${provider === "cb" ? "Codeberg" : "GitHub"}`}
        >
            {provider === "cb" ? <CodebergIcon /> : <GitHubIcon />}
            <span className="sr-only">
                {`Back to ${provider === "cb" ? "Codeberg" : "GitHub"}`}
            </span>
        </a>
    );
}

function usePathParams() {
    const pathname = usePathname();
    const provider: Provider = pathname.startsWith("/cb/") ? "cb" : "gh";
    // Strip optional /gh or /cb prefix for owner/repo extraction
    const cleanPath = pathname.replace(/^\/(?:gh|cb)(?=\/)/, "");

    const repoMatch = cleanPath.match(/^\/([^/]+)\/([^/]+)/);
    const owner = repoMatch?.[1];
    const repo = repoMatch?.[2];

    let pathType: PathType | null = null;

    let pullRequestNumber = null;
    if (repoMatch) {
        const prMatch = cleanPath.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
        const pullsMatch = cleanPath.match(/^\/([^/]+)\/([^/]+)\/pulls/);
        const issuesMatch = cleanPath.match(/^\/([^/]+)\/([^/]+)\/issues/);
        if (pullsMatch) {
            pathType = "PULLS_LIST";
        } else if (issuesMatch) {
            pathType = "ISSUES_LIST";
        } else if (prMatch) {
            pathType = "PULL_REQUEST";
            if (prMatch[3]) {
                pullRequestNumber = parseInt(prMatch[3], 10);
            }
        } else {
            pathType = "REPO";
        }
    }

    return {
        provider,
        owner,
        repo,
        pullRequestNumber,
        pathType,
    };
}

function UserIcon({
    avatarUrl,
    login,
}: {
    avatarUrl?: string | null;
    login?: string | null;
}) {
    return (
        <Link
            className="flex size-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-label dark:hover:text-zinc-200"
            href="/profile"
        >
            {avatarUrl ? (
                <Image
                    src={avatarUrl}
                    alt={login ?? "user"}
                    className="size-6 rounded-full"
                    width={24}
                    height={24}
                />
            ) : (
                <User size={18} />
            )}
            <span className="sr-only">{login ?? "Profile"}</span>
        </Link>
    );
}

function PullRequestSidebarToggles({
    headerRef,
}: {
    headerRef: RefObject<HTMLDivElement | null>;
}) {
    const { isLeftOpen, isRightOpen, toggleLeft, toggleRight } = useSidebar();

    const leftToggleRef = useRef<HTMLButtonElement>(null);
    const rightToggleRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const header = headerRef.current;
        if (!header) return;

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
    }, [headerRef.current]);

    return (
        <>
            {!isLeftOpen && (
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

            <button
                ref={rightToggleRef}
                className="fixed right-0 z-40 flex h-7 w-7 cursor-pointer items-center justify-center rounded-l-md bg-surface text-text-tertiary shadow-sm transition-colors hover:bg-surface-tertiary hover:text-text-label dark:hover:text-zinc-200"
                style={{ top: "var(--header-height)" }}
                onClick={toggleRight}
                title={
                    isRightOpen ? "Close right sidebar" : "Open right sidebar"
                }
                type="button"
            >
                {isRightOpen ? (
                    <PanelRightClose size={16} />
                ) : (
                    <PanelRightOpen size={16} />
                )}
            </button>
        </>
    );
}
