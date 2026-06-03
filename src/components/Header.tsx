"use client";

import {
    PanelLeftOpen,
    PanelRightClose,
    PanelRightOpen,
    User,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { useSidebar } from "./sidebar-context";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
    const pathname = usePathname();
    const prMatch = pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    const repoMatch = pathname.match(/^\/([^/]+)\/([^/]+)/);
    const owner = repoMatch?.[1];
    const repo = repoMatch?.[2];
    const { isLeftOpen, isRightOpen, toggleLeft, toggleRight } = useSidebar();
    const { data: currentUser } = api.users.currentUser.useQuery(undefined, {
        retry: false,
    });
    const { data: ownerData } = api.users.getByUsername.useQuery(
        { username: owner ?? "" },
        { enabled: !!owner, retry: false },
    );

    const headerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const header = headerRef.current;
        if (!header) return;

        const observer = new ResizeObserver(([entry]) => {
            if (entry) {
                document.documentElement.style.setProperty(
                    "--header-height",
                    `${entry.contentRect.height}px`,
                );
            }
        });

        observer.observe(header);
        return () => observer.disconnect();
    }, []);

    return (
        <>
            <header
                className="sticky top-0 z-50 border-gray-200 border-b bg-white dark:border-zinc-800 dark:bg-zinc-950"
                ref={headerRef}
            >
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex size-8 items-center justify-center rounded-md bg-gray-100 font-bold text-gray-700 text-sm dark:bg-zinc-800 dark:text-gray-300">
                                N
                            </div>
                            {repoMatch && (
                                <div className="flex items-center gap-1.5">
                                    <a
                                        className="flex shrink-0 items-center"
                                        href={`https://github.com/${owner}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {ownerData?.user.avatar_url ? (
                                            <img
                                                src={ownerData.user.avatar_url}
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
                            {prMatch && (
                                <a
                                    className="flex size-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
                                    href={`https://github.com/${prMatch[1]}/${prMatch[2]}/pull/${prMatch[3]}?neosrc_exit=1`}
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
            </header>

            {prMatch && !isLeftOpen && (
                <button
                    className="fixed left-0 z-40 flex h-9 w-9 cursor-pointer items-center justify-center rounded-r-md bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-100 hover:text-gray-700 dark:bg-zinc-950 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
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
                    className="fixed right-0 z-40 flex h-9 w-9 cursor-pointer items-center justify-center rounded-l-md bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-100 hover:text-gray-700 dark:bg-zinc-950 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
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
