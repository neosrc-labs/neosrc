"use client";

import { Fzf } from "fzf";
import { SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "~/lib/utils";
import type { CodeSearchResultItem } from "~/server/github";
import { api } from "~/trpc/react";
import { blobHref, type Provider, treeHref } from "~/utils/provider-url";

interface RepoFileSearchProps {
    owner: string;
    repo: string;
    provider: Provider;
    selectedRef: string;
}

const MAX_RESULTS = 20;

/**
 * "Go to file" search over the whole branch: a rail-sized input with a
 * dropdown of matching paths, so the main column stays on the current file or
 * directory.
 */
export function RepoFileSearch({
    owner,
    repo,
    provider,
    selectedRef,
}: RepoFileSearchProps) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    const { data: fileTree, isFetching } = api.repos.getFileTree.useQuery(
        { provider, owner, repo, ref: selectedRef },
        { enabled: query.length > 0 },
    );

    const results = useMemo(() => {
        if (!fileTree || !query) return [];
        const matches = new Fzf(fileTree, {
            selector: (item) => item.path,
            limit: MAX_RESULTS,
        }).find(query);
        return matches.map((match) => match.item);
    }, [fileTree, query]);

    const hrefFor = (item: CodeSearchResultItem) =>
        item.type === "tree"
            ? treeHref(provider, owner, repo, selectedRef, item.path)
            : blobHref(provider, owner, repo, selectedRef, item.path);

    const close = () => setOpen(false);

    return (
        <div
            className="relative"
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    close();
                }
            }}
        >
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
            <input
                aria-label="Go to file"
                className="h-8 w-full rounded-md border border-border bg-transparent py-1 pr-7 pl-8 text-sm text-text-primary placeholder-text-tertiary focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                placeholder="Go to file"
                value={query}
                onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveIndex(0);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={(event) => {
                    if (event.key === "Escape") {
                        setQuery("");
                        close();
                        return;
                    }
                    if (results.length === 0) return;
                    if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setActiveIndex((index) =>
                            Math.min(index + 1, results.length - 1),
                        );
                    } else if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setActiveIndex((index) => Math.max(index - 1, 0));
                    } else if (event.key === "Enter") {
                        const item = results[activeIndex];
                        if (item) {
                            event.preventDefault();
                            close();
                            router.push(hrefFor(item));
                        }
                    }
                }}
            />
            {query && (
                <button
                    aria-label="Clear file search"
                    className="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer rounded p-0.5 text-text-tertiary hover:text-text-primary"
                    onClick={() => {
                        setQuery("");
                        close();
                    }}
                    type="button"
                >
                    <XIcon className="h-3.5 w-3.5" />
                </button>
            )}

            {open && query.length > 0 && (
                <div className="absolute inset-x-0 top-9 z-20 max-h-80 overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
                    {results.length === 0 ? (
                        <p className="px-3 py-3 text-text-tertiary text-xs">
                            {isFetching ? "Searching..." : "No matching files"}
                        </p>
                    ) : (
                        results.map((item, index) => (
                            <Link
                                key={item.path}
                                className={cn(
                                    "block px-3 py-1.5",
                                    index === activeIndex &&
                                        "bg-surface-secondary",
                                )}
                                href={hrefFor(item)}
                                onMouseEnter={() => setActiveIndex(index)}
                                onClick={close}
                            >
                                <span className="block truncate text-sm text-text-primary">
                                    {item.name}
                                </span>
                                <span className="block truncate text-text-tertiary text-xs">
                                    {item.path}
                                </span>
                            </Link>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
