"use client";

import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useRightSidebar } from "./right-sidebar-context";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
    const pathname = usePathname();
    const prMatch = pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    const { isOpen: isRightSidebarOpen, toggle: toggleRightSidebar } =
        useRightSidebar();

    const headerRef = useRef(null);

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
        <header
            className="sticky top-0 z-50 border-gray-200 border-b bg-white dark:border-zinc-800 dark:bg-zinc-950"
            ref={headerRef}
        >
            <div className="px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center">
                    {prMatch && (
                        <a
                            className="font-medium text-gray-700 text-sm hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                            href={`https://github.com/${prMatch[1]}/${prMatch[2]}/pull/${prMatch[3]}`}
                            rel="noopener noreferrer"
                            target="_blank"
                        >
                            ← Back to GitHub
                        </a>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                        <ThemeToggle />
                        {prMatch && (
                            <button
                                className="flex size-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
                                onClick={toggleRightSidebar}
                                title={
                                    isRightSidebarOpen
                                        ? "Close sidebar"
                                        : "Open sidebar"
                                }
                                type="button"
                            >
                                {isRightSidebarOpen ? (
                                    <PanelRightClose size={18} />
                                ) : (
                                    <PanelRightOpen size={18} />
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
