"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StateTabs } from "~/components/list/state-tabs";
import { Pagination } from "~/components/ui/pagination";
import { api } from "~/trpc/react";
import type { Provider } from "~/utils/provider-url";
import { BranchEmptyState } from "./branch-empty-state";
import { BRANCH_TABS, branchConfig } from "./branch-list-config";
import { BranchTable } from "./branch-table";
import { BranchTableSkeleton } from "./branch-table-skeleton";
import { useBranchList } from "./use-branch-list";

/** Rows per page; the pagination control divides the total by the same size. */
const PAGE_SIZE = 30;

/** github.com's branch search is a plain name filter, so no qualifier syntax. */
function BranchSearchBar({
    query,
    onSubmit,
}: {
    query: string;
    onSubmit: (value: string) => void;
}) {
    const [value, setValue] = useState(query);

    return (
        <form
            className="border-border-subtle border-b"
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
    const { tab, query, page, data, isLoading, setParams } = useBranchList({
        owner,
        repo,
        config,
    });
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
            <div className="overflow-hidden rounded-md border border-border-subtle">
                <div className="border-border-subtle border-b">
                    <StateTabs
                        tabs={BRANCH_TABS}
                        activeTab={tab}
                        onTabChange={(next) =>
                            setParams({ tab: next, page: null })
                        }
                    />
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

                {isLoading || !data ? (
                    <BranchTableSkeleton />
                ) : (
                    <>
                        {data.scanLimit && (
                            <p className="border-border-subtle border-b px-4 py-2 text-text-tertiary text-xs">
                                Active and Stale are filtered from the first{" "}
                                {data.scanLimit.scanned} of{" "}
                                {data.scanLimit.total} branches. All lists every
                                branch.
                            </p>
                        )}
                        {tab === "overview" ? (
                            <>
                                {data.defaultBranchRow && (
                                    <>
                                        <SectionHeading>Default</SectionHeading>
                                        {table([data.defaultBranchRow])}
                                    </>
                                )}
                                <SectionHeading>Active branches</SectionHeading>
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
                                                className="cursor-pointer text-blue-600 text-sm hover:underline dark:text-blue-400"
                                            >
                                                View more branches
                                            </Link>
                                        </div>
                                    </>
                                )}
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
                                        data.totalCount / PAGE_SIZE,
                                    )}
                                    onPageChange={(next) =>
                                        setParams({
                                            page:
                                                next === 1
                                                    ? null
                                                    : String(next),
                                        })
                                    }
                                />
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
    return (
        <h2 className="border-border-subtle border-b bg-surface-elevated px-4 py-2 font-semibold text-sm text-text-primary">
            {children}
        </h2>
    );
}
