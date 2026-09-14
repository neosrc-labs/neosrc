"use client";

import Link from "next/link";
import { type Provider, treeHref } from "~/utils/provider-url";

/**
 * `owner / repo / segments` trail above a directory listing. Every crumb links
 * to the tree page it sits on; the last one is the current directory.
 */
export function RepoBreadcrumb({
    owner,
    repo,
    selectedRef,
    provider,
    path,
}: {
    owner: string;
    repo: string;
    selectedRef: string;
    provider: Provider;
    path: string;
}) {
    if (path === "") return null;

    const segments = path.split("/").filter(Boolean);
    const crumbs = [
        { label: owner, path: "" },
        { label: repo, path: "" },
        ...segments.map((segment, index) => ({
            label: segment,
            path: segments.slice(0, index + 1).join("/"),
        })),
    ];

    return (
        <nav
            aria-label="Breadcrumb"
            className="flex min-h-12 flex-wrap items-center gap-1 border-border border-b px-4 py-3 text-sm"
        >
            {crumbs.map((crumb, index) => {
                const isLast = index === crumbs.length - 1;
                return (
                    <span
                        key={`${crumb.path}/${crumb.label}`}
                        className="flex items-center gap-1"
                    >
                        {index > 0 && (
                            <span className="text-text-muted">/</span>
                        )}
                        {isLast ? (
                            <span className="font-semibold text-text-primary">
                                {crumb.label}
                            </span>
                        ) : (
                            <Link
                                href={treeHref(
                                    provider,
                                    owner,
                                    repo,
                                    selectedRef,
                                    crumb.path,
                                )}
                                className="text-blue-600 hover:underline dark:text-blue-400"
                            >
                                {crumb.label}
                            </Link>
                        )}
                    </span>
                );
            })}
        </nav>
    );
}
