"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import { RefSelector } from "~/app/[owner]/[repo]/_components/ref-selector";
import { AuthorDropdown } from "~/app/[owner]/[repo]/_components/search/author-dropdown";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { CommitRow } from "./commit-row";
import type { CommitsListConfig } from "./commits-list-config";

interface CommitsListProps {
    owner: string;
    repo: string;
    branch: string;
    config: CommitsListConfig;
}

function CommitsListInner({ owner, repo, branch, config }: CommitsListProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
    const author = searchParams.get("author") ?? undefined;

    const pageStartCursors = useRef<Map<number, string>>(new Map());
    const [nav, setNav] = useState<{
        page: number;
        afterCursor?: string;
        beforeCursor?: string;
    }>({ page });

    const { data, isLoading, isError, error } =
        api.commits.listCommits.useQuery(
            {
                provider: config.provider,
                owner,
                repo,
                branch,
                page: nav.page,
                perPage: 35,
                author: author ?? undefined,
                afterCursor: nav.afterCursor,
                beforeCursor: nav.beforeCursor,
            },
            {
                placeholderData: (prev) => prev,
            },
        );

    // Save cursor for backward navigation
    if (data?.cursors?.start) {
        pageStartCursors.current.set(nav.page, data.cursors.start);
    }

    const updateParams = useCallback(
        (updates: Record<string, string | undefined>) => {
            const params = new URLSearchParams(searchParams.toString());
            for (const [key, value] of Object.entries(updates)) {
                if (value === undefined || value === "") {
                    params.delete(key);
                } else {
                    params.set(key, value);
                }
            }
            router.push(`?${params.toString()}`, { scroll: false });
        },
        [router, searchParams],
    );

    const handleNext = useCallback(() => {
        if (!data?.cursors?.end) return;
        setNav({ page: nav.page + 1, afterCursor: data.cursors.end });
        updateParams({ page: String(nav.page + 1) });
    }, [data?.cursors?.end, nav.page, updateParams]);

    const handlePrevious = useCallback(() => {
        if (nav.page <= 1) return;
        const startCursor = pageStartCursors.current.get(nav.page);
        setNav({ page: nav.page - 1, beforeCursor: startCursor });
        updateParams({ page: String(nav.page - 1) });
    }, [nav.page, updateParams]);

    const handleBranchChange = useCallback(
        (newBranch: string) => {
            setNav({ page: 1 });
            router.push(
                `${config.basePath}/${owner}/${repo}/commits/${newBranch}`,
            );
        },
        [config.basePath, owner, repo, router],
    );

    const handleAuthorToggle = useCallback(
        (_key: string, value: string) => {
            const login = value.replace(/^author:/, "");
            if (author === login) {
                updateParams({ author: undefined, page: "1" });
                setNav({ page: 1 });
            } else {
                updateParams({ author: login, page: "1" });
                setNav({ page: 1 });
            }
        },
        [author, updateParams],
    );

    // Group commits by date
    const groupedCommits = useMemo(() => {
        if (!data?.commits) return [];
        const groups = new Map<string, typeof data.commits>();
        for (const commit of data.commits) {
            const dateKey = new Date(commit.committedDate).toLocaleDateString(
                "en-US",
                { year: "numeric", month: "long", day: "numeric" },
            );
            const group = groups.get(dateKey);
            if (group) {
                group.push(commit);
            } else {
                groups.set(dateKey, [commit]);
            }
        }
        return Array.from(groups.entries());
    }, [data?.commits]);

    const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / 35)) : 1;

    // Pagination button styles (reuse from pagination.tsx)
    const btnBase =
        "inline-flex items-center justify-center gap-1 rounded-md px-3 py-1.5 font-medium text-sm transition-colors";
    const btnActive =
        "cursor-pointer text-text-label hover:bg-surface-tertiary hover:text-text-primary dark:hover:text-zinc-100";
    const btnDisabled = "cursor-not-allowed text-text-muted opacity-50";

    return (
        <div>
            {/* Toolbar */}
            <div className="mb-6 flex items-center justify-between gap-4">
                <RefSelector
                    owner={owner}
                    repo={repo}
                    provider={config.provider}
                    selectedRef={branch}
                    onSelect={handleBranchChange}
                />

                <div className="flex items-center gap-2">
                    {author && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-surface-tertiary px-2 py-1 text-sm">
                            <span className="text-text-secondary">author:</span>
                            <span className="font-medium text-text-primary">
                                {author}
                            </span>
                            <button
                                type="button"
                                onClick={() =>
                                    handleAuthorToggle(
                                        "author",
                                        `author:${author}`,
                                    )
                                }
                                className="ml-0.5 rounded p-0.5 text-text-muted transition-colors hover:text-text-primary"
                                aria-label={`Clear author filter`}
                            >
                                <X className="size-3" />
                            </button>
                        </span>
                    )}
                    <AuthorDropdown
                        owner={owner}
                        repo={repo}
                        provider={config.provider}
                        currentQuery={author ? `author:${author}` : ""}
                        onToggle={handleAuthorToggle}
                    />
                </div>
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="space-y-0 divide-y divide-border-subtle rounded-lg border border-border-subtle">
                    {Array.from({ length: 5 }).map(() => (
                        <div
                            key={crypto.randomUUID()}
                            className="flex animate-pulse items-center gap-3 px-4 py-3"
                        >
                            <div className="h-4 w-2/3 rounded bg-surface-tertiary" />
                            <div className="h-4 w-16 rounded bg-surface-tertiary" />
                            <div className="h-4 w-14 rounded bg-surface-tertiary" />
                        </div>
                    ))}
                </div>
            )}

            {/* Error */}
            {isError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950">
                    <p className="text-red-600 dark:text-red-400">
                        {(error as unknown as Error)?.message ??
                            "Failed to load commits"}
                    </p>
                </div>
            )}

            {/* Empty */}
            {!isLoading && !isError && data && data.commits.length === 0 && (
                <div className="rounded-lg border border-border-subtle bg-surface p-12 text-center">
                    <p className="text-text-secondary">
                        No commits found
                        {author && ". Try clearing the author filter."}
                    </p>
                </div>
            )}

            {/* Commit list */}
            {!isLoading && !isError && groupedCommits.length > 0 && (
                <div>
                    <div className="space-y-6">
                        {groupedCommits.map(([dateLabel, commits]) => (
                            <div key={dateLabel}>
                                <h3 className="mb-2 px-2 py-1 font-medium text-sm text-text-secondary">
                                    {dateLabel}
                                </h3>
                                <div className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-surface">
                                    {commits.map((commit) => (
                                        <CommitRow
                                            key={commit.sha}
                                            commit={commit}
                                            owner={owner}
                                            repo={repo}
                                            provider={config.provider}
                                            showStatus={config.showStatusChecks}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination footer */}
                    <div className="mt-6 flex items-center justify-center gap-4">
                        <button
                            type="button"
                            onClick={handlePrevious}
                            disabled={nav.page <= 1}
                            className={cn(
                                btnBase,
                                nav.page <= 1 ? btnDisabled : btnActive,
                            )}
                        >
                            <ChevronLeft className="size-4" />
                            Previous
                        </button>
                        <span className="text-sm text-text-secondary">
                            Page {nav.page} of {totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={handleNext}
                            disabled={nav.page >= totalPages}
                            className={cn(
                                btnBase,
                                nav.page >= totalPages
                                    ? btnDisabled
                                    : btnActive,
                            )}
                        >
                            Next
                            <ChevronRight className="size-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export function CommitsList(props: CommitsListProps) {
    return (
        <Suspense
            fallback={
                <div className="space-y-0 divide-y divide-border-subtle rounded-lg border border-border-subtle">
                    {Array.from({ length: 5 }).map(() => (
                        <div
                            key={crypto.randomUUID()}
                            className="flex animate-pulse items-center gap-3 px-4 py-3"
                        >
                            <div className="h-4 w-2/3 rounded bg-surface-tertiary" />
                            <div className="h-4 w-16 rounded bg-surface-tertiary" />
                            <div className="h-4 w-14 rounded bg-surface-tertiary" />
                        </div>
                    ))}
                </div>
            }
        >
            <CommitsListInner {...props} />
        </Suspense>
    );
}
