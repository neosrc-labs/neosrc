"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { StateTabs } from "~/components/list/state-tabs";
import { Pagination } from "~/components/ui/pagination";
import { api } from "~/trpc/react";
import type { Provider } from "~/utils/provider-url";
import { BranchEmptyState } from "./branch-empty-state";
import {
    BRANCH_PAGE_SIZE,
    BRANCH_TABS,
    branchConfig,
} from "./branch-list-config";
import { BranchSection } from "./branch-section";
import { BranchTable } from "./branch-table";
import { BranchTableSkeleton } from "./branch-table-skeleton";
import { useBranchList } from "./use-branch-list";

/** github.com's branch search is a plain name filter, so no qualifier syntax. */
function BranchSearchBar({
    query,
    onSubmit,
}: {
    query: string;
    onSubmit: (value: string) => void;
}) {
    const [value, setValue] = useState(query);

    // Browser back/forward and the "View more branches" link change the query
    // without remounting this input.
    useEffect(() => {
        setValue(query);
    }, [query]);

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                onSubmit(value.trim());
            }}
        >
            <div className="flex items-center gap-1 px-4 py-2">
                <div className="relative flex flex-1 items-center">
                    <Search className="pointer-events-none absolute left-3 size-4 text-text-muted" />
                    <input
                        type="search"
                        aria-label="Search branches"
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        placeholder="Search branches..."
                        className="w-full rounded-md border border-gray-300 bg-transparent py-1.5 pr-8 pl-9 text-sm text-text-primary placeholder-gray-500 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:placeholder-zinc-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    />
                    {value !== "" && (
                        <button
                            type="button"
                            aria-label="Clear branch search"
                            onClick={() => {
                                setValue("");
                                onSubmit("");
                            }}
                            className="absolute right-2 flex size-4 cursor-pointer items-center justify-center rounded-full text-text-muted hover:text-text-secondary dark:hover:text-zinc-300"
                        >
                            <X className="size-3" />
                        </button>
                    )}
                </div>
            </div>
        </form>
    );
}

export function BranchListShared({
    owner,
    repo,
    provider,
}: {
    owner: string;
    repo: string;
    provider: Provider;
}) {
    const config = branchConfig(provider);
    const {
        tab,
        query,
        page,
        data,
        isLoading,
        isError,
        error,
        refetch,
        setParams,
    } = useBranchList({ owner, repo, config });
    const { data: repoInfo } = api.repos.getByOwnerAndRepo.useQuery({
        provider: config.provider,
        owner,
        repo,
    });

    const canManage = repoInfo?.permissions.write ?? false;
    const isAdmin = repoInfo?.permissions.admin ?? false;
    const defaultBranch = repoInfo?.defaultBranch ?? null;
    const allHref =
        query === ""
            ? "?tab=all"
            : `?tab=all&query=${encodeURIComponent(query)}`;
    // A provider that cannot read every branch says so next to the tabs, where
    // it costs no layout.
    const scanNote = data?.scanLimit
        ? tab === "all"
            ? `Showing the first ${data.scanLimit.scanned} of ${data.scanLimit.total} branches.`
            : `Active and Stale are computed from ${data.scanLimit.scanned} of ${data.scanLimit.total} branches.`
        : null;

    const table = (rows: NonNullable<typeof data>["items"]) => (
        <BranchTable
            owner={owner}
            repo={repo}
            rows={rows}
            canManage={canManage}
            isAdmin={isAdmin}
            defaultBranch={defaultBranch}
            config={config}
        />
    );

    return (
        <div>
            <h1 className="mb-4 font-semibold text-2xl text-text-primary">
                Branches
            </h1>
            <div
                className={
                    tab === "overview"
                        ? "space-y-6"
                        : "overflow-hidden rounded-md border border-border-subtle"
                }
            >
                <div
                    className={
                        tab === "overview"
                            ? "overflow-hidden rounded-md border border-border-subtle"
                            : "border-border-subtle border-b"
                    }
                >
                    <div className="flex items-center justify-between gap-2 border-border-subtle border-b">
                        <div className="shrink-0">
                            <StateTabs
                                tabs={BRANCH_TABS}
                                activeTab={tab}
                                onTabChange={(next) =>
                                    setParams({ tab: next, page: null })
                                }
                            />
                        </div>
                        {scanNote && (
                            <p className="min-w-0 flex-1 truncate pr-4 text-right text-text-tertiary text-xs">
                                {scanNote}
                            </p>
                        )}
                    </div>
                    <BranchSearchBar
                        query={query}
                        onSubmit={(value) =>
                            setParams({
                                query: value === "" ? null : value,
                                page: null,
                            })
                        }
                    />
                </div>

                {isError ? (
                    <div className="px-6 py-12 text-center">
                        <p className="font-medium text-base text-text-primary">
                            Couldn&apos;t load branches.
                        </p>
                        {error?.message && (
                            <p className="mt-1 text-sm text-text-tertiary">
                                {error.message}
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={() => void refetch()}
                            className="mt-2 cursor-pointer text-blue-600 text-sm hover:underline dark:text-blue-400"
                        >
                            Try again
                        </button>
                    </div>
                ) : isLoading || !data ? (
                    <BranchTableSkeleton tab={tab} />
                ) : tab === "overview" ? (
                    <>
                        {data.defaultBranchRow && (
                            <BranchSection title="Default">
                                {table([data.defaultBranchRow])}
                            </BranchSection>
                        )}
                        <BranchSection title="Active branches">
                            {data.items.length === 0 ? (
                                <BranchEmptyState
                                    searchQuery={query}
                                    activeTab={tab}
                                />
                            ) : (
                                <>
                                    {table(data.items)}
                                    <div className="px-4 py-3">
                                        <Link
                                            href={allHref}
                                            prefetch={false}
                                            className="block cursor-pointer text-blue-600 text-sm hover:underline dark:text-blue-400"
                                        >
                                            View more branches
                                        </Link>
                                    </div>
                                </>
                            )}
                        </BranchSection>
                    </>
                ) : (
                    <>
                        {data.items.length === 0 ? (
                            <BranchEmptyState
                                searchQuery={query}
                                activeTab={tab}
                            />
                        ) : (
                            table(data.items)
                        )}
                        <Pagination
                            currentPage={page}
                            totalPages={Math.ceil(
                                data.totalCount / BRANCH_PAGE_SIZE,
                            )}
                            onPageChange={(next) =>
                                setParams({
                                    page: next === 1 ? null : String(next),
                                })
                            }
                        />
                    </>
                )}
            </div>
        </div>
    );
}
