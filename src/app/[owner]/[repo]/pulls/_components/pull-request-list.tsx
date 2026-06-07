"use client";

import {
    ChevronLeft,
    ChevronRight,
    GitMerge,
    GitPullRequest,
    GitPullRequestClosed,
    ListOrdered,
    Tag,
    User,
    X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Label as LabelComponent } from "~/components/ui/label";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";
import { cn } from "~/lib/utils";
import type { GqlPrSearchItem } from "~/server/github-graphql";
import { api } from "~/trpc/react";
import type { PrRowData } from "./pull-request-row";
import { PullRequestRow } from "./pull-request-row";
import {
    addQualifier,
    hasQualifier,
    parseQuery,
    removeQualifier,
} from "./search-utils";

type FilterState = "open" | "closed" | "merged";

const TABS: { key: FilterState; label: string }[] = [
    { key: "open", label: "Open" },
    { key: "closed", label: "Closed" },
    { key: "merged", label: "Merged" },
];

const SORT_OPTIONS: {
    label: string;
    sort: "created" | "updated" | "comments";
    order: "asc" | "desc";
}[] = [
    { label: "Newest", sort: "created", order: "desc" },
    { label: "Oldest", sort: "created", order: "asc" },
    { label: "Recently updated", sort: "updated", order: "desc" },
    { label: "Most commented", sort: "comments", order: "desc" },
];

function getStatusState(item: GqlPrSearchItem): string | null {
    const rollup = item.commits.nodes[0]?.commit.statusCheckRollup;
    return rollup?.state ?? null;
}

function getStatusContexts(
    item: GqlPrSearchItem,
): PrRowData["status_contexts"] {
    const rollup = item.commits.nodes[0]?.commit.statusCheckRollup;
    if (!rollup) return [];
    return rollup.contexts.nodes.map((ctx) => {
        if (ctx.__typename === "CheckRun") {
            return {
                name: ctx.name,
                state: ctx.conclusion ?? ctx.status,
                description: null,
                url: ctx.detailsUrl,
            };
        }
        return {
            name: ctx.context,
            state: ctx.state,
            description: ctx.description,
            url: ctx.targetUrl,
        };
    });
}

function normalizeSearchItem(item: GqlPrSearchItem): PrRowData {
    const assigneeNode = item.assignees.nodes[0];
    return {
        id: item.databaseId,
        number: item.number,
        title: item.title,
        state: item.state === "MERGED" ? "closed" : item.state.toLowerCase(),
        draft: item.isDraft,
        user: item.author
            ? {
                  login: item.author.login,
                  avatar_url: item.author.avatarUrl,
              }
            : null,
        assignee: assigneeNode
            ? {
                  login: assigneeNode.login,
                  avatar_url: assigneeNode.avatarUrl,
              }
            : null,
        labels: item.labels.nodes.map((l) => ({
            id: undefined,
            name: l.name,
            color: l.color,
        })),
        created_at: item.createdAt,
        merged_at: item.mergedAt,
        comments_count: item.comments.totalCount,
        status_state: getStatusState(item),
        status_contexts: getStatusContexts(item),
    };
}

const QUALIFIER_LABELS: Record<string, string> = {
    is: "State",
    author: "Author",
    label: "Label",
    assignee: "Assignee",
    milestone: "Milestone",
    reviewed_by: "Reviewer",
    review_requested: "Review requested",
    head: "Head branch",
    base: "Base branch",
    draft: "Draft",
};

function qualifierLabel(key: string, value: string): string {
    const prefix = QUALIFIER_LABELS[key] ?? key;
    return `${prefix}: ${value}`;
}

function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

export function PullRequestList({
    owner,
    repo,
    defaultState,
}: {
    owner: string;
    repo: string;
    defaultState: FilterState;
}) {
    const searchParams = useSearchParams();
    const router = useRouter();

    const activeTab: FilterState =
        (searchParams.get("state") as FilterState) ?? defaultState;
    const currentPage = parseInt(searchParams.get("page") ?? "1", 10);
    const searchQuery = searchParams.get("q") ?? "";
    const currentSort = (searchParams.get("sort") ?? "created") as
        | "created"
        | "updated"
        | "comments";
    const currentOrder = (searchParams.get("order") ?? "desc") as
        | "asc"
        | "desc";

    const [pageCursors, setPageCursors] = useState<Record<number, string>>({});
    const prevQueryKey = useRef<string | undefined>(undefined);

    // Reset cursors when query changes
    const queryKey = `${activeTab}:${searchQuery}:${currentSort}:${currentOrder}`;
    if (
        prevQueryKey.current !== undefined &&
        prevQueryKey.current !== queryKey
    ) {
        setPageCursors({});
    }
    prevQueryKey.current = queryKey;

    const stateQualifier =
        activeTab === "merged" ? "is:merged" : `is:${activeTab}`;
    const apiQuery = searchQuery
        ? `${stateQualifier} ${searchQuery}`
        : stateQualifier;

    // For GraphQL cursor pagination: if we have the cursor for the previous page, use it
    // Otherwise fetch enough items to cover the current page from the start
    const after =
        currentPage > 1 ? (pageCursors[currentPage - 1] ?? null) : null;
    const first = after ? 30 : currentPage * 30;

    const { data, isLoading } = api.pulls.search.useQuery({
        owner,
        repo,
        query: apiQuery,
        page: currentPage,
        after: after ?? undefined,
        first,
        sort: currentSort,
        order: currentOrder,
    });

    // Store cursor for current page
    useEffect(() => {
        const cursor = data?.endCursor;
        if (cursor) {
            setPageCursors((prev) => ({
                ...prev,
                [currentPage]: cursor,
            }));
        }
    }, [data?.endCursor, currentPage]);

    // If we fetched extra items, slice to just the current page
    const allItems = useMemo(
        () => (data?.items ?? []).map(normalizeSearchItem),
        [data],
    );
    const items = after
        ? allItems.slice(0, 30)
        : allItems.slice((currentPage - 1) * 30, currentPage * 30);
    const totalCount = data?.totalCount ?? 0;
    const hasNext = data?.hasNextPage ?? false;

    const parsedQuery = useMemo(() => parseQuery(searchQuery), [searchQuery]);

    const navigate = useCallback(
        (changes: Record<string, string | null>) => {
            const params = new URLSearchParams(searchParams.toString());
            for (const [key, value] of Object.entries(changes)) {
                if (value === null) params.delete(key);
                else params.set(key, value);
            }
            window.scrollTo({ top: 0, behavior: "smooth" });
            router.replace(`/${owner}/${repo}/pulls?${params.toString()}`);
        },
        [owner, repo, router, searchParams],
    );

    const setTab = useCallback(
        (tab: FilterState) => {
            navigate({ state: tab === "open" ? null : tab, page: null });
        },
        [navigate],
    );

    const [searchInput, setSearchInput] = useState(searchQuery);

    useEffect(() => {
        setSearchInput(searchQuery);
    }, [searchQuery]);

    const debouncedSearch = useDebounce(searchInput, 300);

    useEffect(() => {
        if (
            debouncedSearch !== searchQuery &&
            debouncedSearch === searchInput
        ) {
            const params = new URLSearchParams(searchParams.toString());
            if (debouncedSearch) params.set("q", debouncedSearch);
            else params.delete("q");
            params.delete("page");
            router.replace(`/${owner}/${repo}/pulls?${params.toString()}`);
        }
    }, [
        debouncedSearch,
        searchQuery,
        searchInput,
        searchParams,
        router,
        owner,
        repo,
    ]);

    const handleRemoveQualifier = useCallback(
        (key: string, value: string) => {
            const newQuery = removeQualifier(searchQuery, key, value);
            setSearchInput(newQuery);
            navigate({ q: newQuery || null, page: null });
        },
        [navigate, searchQuery],
    );

    const handleAddQualifier = useCallback(
        (key: string, value: string) => {
            const newQuery = addQualifier(searchQuery, key, value);
            setSearchInput(newQuery);
            navigate({ q: newQuery || null, page: null });
        },
        [navigate, searchQuery],
    );

    return (
        <div>
            <div className="border-gray-200 border-b dark:border-zinc-800">
                <div className="flex items-center gap-1 px-4 py-2">
                    <div className="relative flex flex-1 items-center">
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search pull requests by title, body, or comments"
                            className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 pr-8 text-gray-900 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                        />
                        {searchInput && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchInput("");
                                    navigate({ q: null, page: null });
                                }}
                                className="absolute right-2 flex size-4 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <X className="size-3" />
                            </button>
                        )}
                    </div>

                    <AuthorDropdown
                        owner={owner}
                        repo={repo}
                        currentQuery={searchQuery}
                        onToggle={(key: string, value: string) => {
                            if (hasQualifier(searchQuery, key, value)) {
                                handleRemoveQualifier(key, value);
                            } else {
                                handleAddQualifier(key, value);
                            }
                        }}
                    />

                    <LabelDropdown
                        owner={owner}
                        repo={repo}
                        currentQuery={searchQuery}
                        onToggle={(labelName: string) => {
                            if (hasQualifier(searchQuery, "label", labelName)) {
                                handleRemoveQualifier("label", labelName);
                            } else {
                                handleAddQualifier("label", labelName);
                            }
                        }}
                    />

                    <SortDropdown
                        currentSort={currentSort}
                        currentOrder={currentOrder}
                        onSelect={(sort, order) =>
                            navigate({ sort, order, page: null })
                        }
                    />
                </div>

                {parsedQuery.qualifiers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-4 pb-2">
                        {parsedQuery.qualifiers.map((q) => (
                            <span
                                key={`${q.key}:${q.value}`}
                                className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2 py-0.5 font-medium text-blue-700 text-xs dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
                            >
                                {qualifierLabel(q.key, q.value)}
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleRemoveQualifier(q.key, q.value)
                                    }
                                    className="ml-0.5 cursor-pointer rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-500/20"
                                >
                                    <X className="size-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="border-gray-200 border-b dark:border-zinc-800">
                <div className="flex items-center justify-between px-4">
                    <div className="flex">
                        {TABS.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setTab(tab.key)}
                                className={cn(
                                    "relative -mb-px cursor-pointer px-4 py-3 font-medium text-sm transition-colors",
                                    activeTab === tab.key
                                        ? "border-blue-500 border-b-2 text-gray-900 dark:text-gray-100"
                                        : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100",
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    {!isLoading && (
                        <span className="text-gray-500 text-xs dark:text-gray-500">
                            {totalCount.toLocaleString()} results
                        </span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3 border-gray-200 border-b px-4 py-1.5 text-gray-400 text-xs dark:border-zinc-800 dark:text-gray-500">
                <div className="size-4 shrink-0" />
                <div className="flex-1" />
                <div className="flex w-20 shrink-0 items-center justify-center">
                    <span>Assignee</span>
                </div>
                <div className="flex w-16 shrink-0 items-center justify-end">
                    <span>Comments</span>
                </div>
            </div>
            <div>
                {isLoading ? (
                    <div className="space-y-0">
                        {["sk1", "sk2", "sk3", "sk4", "sk5"].map((id) => (
                            <div
                                key={id}
                                className="flex items-center gap-3 border-gray-200 border-b px-4 py-3 dark:border-zinc-800"
                            >
                                <div className="size-4 shrink-0 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                                    <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                                </div>
                                <div className="flex w-20 shrink-0 items-center justify-center">
                                    <div className="size-5 animate-pulse rounded-full bg-gray-200 dark:bg-zinc-700" />
                                </div>
                                <div className="flex w-16 shrink-0 items-center justify-end">
                                    <div className="h-4 w-8 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                        {searchQuery ? (
                            <>
                                <GitPullRequest className="size-8 text-gray-400" />
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                    No pull requests match your search
                                </p>
                                <p className="text-gray-500 text-sm dark:text-gray-400">
                                    Try a different search or clear filters
                                </p>
                            </>
                        ) : activeTab === "open" ? (
                            <>
                                <GitPullRequest className="size-8 text-gray-400" />
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                    No open pull requests
                                </p>
                            </>
                        ) : activeTab === "closed" ? (
                            <>
                                <GitPullRequestClosed className="size-8 text-gray-400" />
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                    No closed pull requests
                                </p>
                            </>
                        ) : (
                            <>
                                <GitMerge className="size-8 text-gray-400" />
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                    No merged pull requests
                                </p>
                            </>
                        )}
                    </div>
                ) : (
                    <div>
                        {items.map((pr) => (
                            <PullRequestRow
                                key={pr.id}
                                pr={pr}
                                owner={owner}
                                repo={repo}
                                onAssigneesFilter={(login) => {
                                    const newQuery = hasQualifier(
                                        searchQuery,
                                        "assignee",
                                        login,
                                    )
                                        ? removeQualifier(
                                              searchQuery,
                                              "assignee",
                                              login,
                                          )
                                        : addQualifier(
                                              searchQuery,
                                              "assignee",
                                              login,
                                          );
                                    setSearchInput(newQuery);
                                    navigate({
                                        q: newQuery || null,
                                        page: null,
                                    });
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {!isLoading && items.length > 0 && (
                <div className="flex items-center justify-between border-gray-200 border-t px-4 py-3 dark:border-zinc-800">
                    <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() =>
                            navigate({ page: String(currentPage - 1) })
                        }
                        className={cn(
                            "inline-flex items-center gap-1 rounded-md px-3 py-1.5 font-medium text-sm transition-colors",
                            currentPage <= 1
                                ? "cursor-not-allowed text-gray-400 dark:text-gray-600"
                                : "cursor-pointer text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-zinc-800 dark:hover:text-gray-100",
                        )}
                    >
                        <ChevronLeft className="size-4" />
                        Previous
                    </button>
                    <span className="text-gray-600 text-sm dark:text-gray-400">
                        Page {currentPage}
                    </span>
                    <button
                        type="button"
                        disabled={!hasNext}
                        onClick={() =>
                            navigate({ page: String(currentPage + 1) })
                        }
                        className={cn(
                            "inline-flex items-center gap-1 rounded-md px-3 py-1.5 font-medium text-sm transition-colors",
                            !hasNext
                                ? "cursor-not-allowed text-gray-400 dark:text-gray-600"
                                : "cursor-pointer text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-zinc-800 dark:hover:text-gray-100",
                        )}
                    >
                        Next
                        <ChevronRight className="size-4" />
                    </button>
                </div>
            )}
        </div>
    );
}

function AuthorDropdown({
    owner,
    repo,
    currentQuery,
    onToggle,
}: {
    owner: string;
    repo: string;
    currentQuery: string;
    onToggle: (key: string, value: string) => void;
}) {
    const { data: users } = api.pulls.listAssignees.useQuery({ owner, repo });
    const [searchText, setSearchText] = useState("");
    const debouncedSearch = useDebounce(searchText, 300);

    const filtered = useMemo(
        () =>
            (users ?? []).filter(
                (u: { login: string }) =>
                    u.login.toLowerCase().includes(searchText.toLowerCase()) &&
                    !currentQuery.includes(`author:${u.login}`),
            ),
        [users, searchText, currentQuery],
    );

    const isCustomAuthor =
        debouncedSearch.length > 0 &&
        !filtered.some(
            (u: { login: string }) =>
                u.login.toLowerCase() === debouncedSearch.toLowerCase(),
        );

    const { data: searchedUserRaw, isFetched: userSearchDone } =
        api.users.getByUsername.useQuery(
            { username: debouncedSearch },
            { enabled: isCustomAuthor, retry: false },
        );
    const searchedUser = (
        searchedUserRaw as { user?: { avatar_url?: string } } | undefined
    )?.user;
    const userNotFound = isCustomAuthor && userSearchDone && !searchedUser;

    const customAuthorItem =
        isCustomAuthor && !userNotFound
            ? [
                  {
                      login: debouncedSearch,
                      avatar_url: searchedUser?.avatar_url ?? "",
                      isCustom: true as const,
                  },
              ]
            : [];

    const allItems = [...filtered, ...customAuthorItem];

    const selectedNames = new Set(
        (users ?? [])
            .filter((u: { login: string }) =>
                currentQuery.includes(`author:${u.login}`),
            )
            .map((u: { login: string }) => u.login),
    );

    return (
        <SearchableDropdown
            items={allItems}
            isSelected={(u: { login: string }) => selectedNames.has(u.login)}
            onSelect={(u: { login: string }) => onToggle("author", u.login)}
            keyFn={(u: { login: string }) => u.login}
            searchFn={(u: { login: string }, q: string) =>
                u.login.toLowerCase().includes(q.toLowerCase())
            }
            renderItem={(
                u: { login: string; avatar_url?: string },
                selected: boolean,
            ) => (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    {u.avatar_url ? (
                        <img
                            src={u.avatar_url}
                            alt=""
                            className="size-5 shrink-0 rounded-full"
                        />
                    ) : (
                        <div className="size-5 shrink-0 rounded-full bg-gray-200 dark:bg-zinc-700" />
                    )}
                    <span className="truncate">{u.login}</span>
                    {selected && (
                        <span className="ml-auto shrink-0 text-blue-600 text-xs dark:text-blue-400">
                            &#10003;
                        </span>
                    )}
                </div>
            )}
            placeholder="Filter users..."
            emptyText={
                isCustomAuthor && userNotFound
                    ? "No users found"
                    : "No users found"
            }
            ariaLabel="Filter by author"
            onSearchChange={setSearchText}
            trigger={
                <button
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800"
                >
                    <User className="size-4" />
                    Author
                </button>
            }
        />
    );
}

function LabelDropdown({
    owner,
    repo,
    currentQuery,
    onToggle,
}: {
    owner: string;
    repo: string;
    currentQuery: string;
    onToggle: (labelName: string) => void;
}) {
    const { data: labels } = api.pulls.listLabels.useQuery({ owner, repo });

    const items = labels ?? [];
    const currentNames = new Set(
        items
            .filter((l: { name: string }) =>
                currentQuery.includes(`label:${l.name}`),
            )
            .map((l: { name: string }) => l.name),
    );

    return (
        <SearchableDropdown
            items={items}
            isSelected={(l: { name: string }) => currentNames.has(l.name)}
            onSelect={(l: { name: string }) => onToggle(l.name)}
            keyFn={(l: { name: string }) => l.name}
            searchFn={(l: { name: string }, q: string) =>
                l.name.toLowerCase().includes(q.toLowerCase())
            }
            renderItem={(
                l: { name: string; color: string; description?: string | null },
                selected: boolean,
            ) => (
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                        <LabelComponent
                            color={l.color}
                            description={l.description ?? undefined}
                        >
                            {l.name}
                        </LabelComponent>
                        {selected && (
                            <span className="shrink-0 text-blue-600 text-xs dark:text-blue-400">
                                &#10003;
                            </span>
                        )}
                    </div>
                    {l.description && (
                        <span className="truncate text-gray-400 text-xs">
                            {l.description}
                        </span>
                    )}
                </div>
            )}
            placeholder="Filter labels"
            emptyText="No labels found"
            ariaLabel="Filter by label"
            trigger={
                <button
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800"
                >
                    <Tag className="size-4" />
                    Label
                </button>
            }
        />
    );
}

function SortDropdown({
    currentSort,
    currentOrder,
    onSelect,
}: {
    currentSort: string;
    currentOrder: string;
    onSelect: (
        sort: "created" | "updated" | "comments",
        order: "asc" | "desc",
    ) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const currentLabel =
        SORT_OPTIONS.find(
            (o) => o.sort === currentSort && o.order === currentOrder,
        )?.label ?? "Newest";

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800"
            >
                <ListOrdered className="size-4" />
                {currentLabel}
            </button>
            {open && (
                <div className="absolute top-full right-0 z-50 mt-1 w-44 rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                    {SORT_OPTIONS.map((opt) => (
                        <button
                            key={opt.label}
                            type="button"
                            onClick={() => {
                                onSelect(opt.sort, opt.order);
                                setOpen(false);
                            }}
                            className={cn(
                                "flex w-full cursor-pointer items-center rounded-md px-3 py-1.5 text-sm transition-colors",
                                opt.sort === currentSort &&
                                    opt.order === currentOrder
                                    ? "bg-gray-100 font-medium text-gray-900 dark:bg-zinc-800 dark:text-gray-100"
                                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800",
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
