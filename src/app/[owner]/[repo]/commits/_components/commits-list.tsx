"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { CommitsGroupedList } from "./commits-grouped-list";
import type { CommitsListConfig } from "./commits-list-config";
import { CommitsPaginationFooter } from "./commits-pagination-footer";
import { CommitsToolbar } from "./commits-toolbar";

interface CommitsListProps {
    owner: string;
    repo: string;
    branch: string;
    config: CommitsListConfig;
}

function SkeletonList() {
    return (
        <div className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
            {Array.from({ length: 15 }).map(() => (
                <div
                    key={crypto.randomUUID()}
                    className="flex animate-pulse items-center gap-2 px-4 py-2.5"
                >
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="h-5 w-3/4 rounded bg-surface-tertiary" />
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full bg-surface-tertiary" />
                            <div className="h-4 w-20 rounded bg-surface-tertiary" />
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                        <div className="h-4 w-14 rounded bg-surface-tertiary" />
                        <div className="h-4 w-4 rounded bg-surface-tertiary" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function CommitsList(props: CommitsListProps) {
    return (
        <Suspense fallback={<SkeletonList />}>
            <CommitsListInner {...props} />
        </Suspense>
    );
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

    return (
        <div>
            <CommitsToolbar
                owner={owner}
                repo={repo}
                branch={branch}
                provider={config.provider}
                author={author}
                onBranchChange={handleBranchChange}
                onAuthorToggle={handleAuthorToggle}
            />

            {isLoading && <SkeletonList />}

            {isError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950">
                    <p className="text-red-600 dark:text-red-400">
                        {(error as unknown as Error)?.message ??
                            "Failed to load commits"}
                    </p>
                </div>
            )}

            {!isLoading && !isError && data && data.commits.length === 0 && (
                <div className="rounded-lg border border-border-subtle bg-surface p-12 text-center">
                    <p className="text-text-secondary">
                        No commits found
                        {author && ". Try clearing the author filter."}
                    </p>
                </div>
            )}

            {!isLoading && !isError && groupedCommits.length > 0 && (
                <>
                    <CommitsGroupedList
                        groupedCommits={groupedCommits}
                        owner={owner}
                        repo={repo}
                        provider={config.provider}
                        showStatus={config.showStatusChecks}
                    />
                    <CommitsPaginationFooter
                        page={nav.page}
                        totalPages={totalPages}
                        onPrevious={handlePrevious}
                        onNext={handleNext}
                    />
                </>
            )}
        </div>
    );
}
