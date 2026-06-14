"use client";

import {
    ChevronDown,
    CircleCheck,
    Eye,
    GitMerge,
    GitPullRequest,
    GitPullRequestClosed,
    Milestone,
    Search,
    Tag,
    X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AssigneeDropdown } from "~/app/[owner]/[repo]/_components/search/assignee-dropdown";
import { AuthorDropdown } from "~/app/[owner]/[repo]/_components/search/author-dropdown";
import { LabelDropdown } from "~/app/[owner]/[repo]/_components/search/label-dropdown";
import { MilestoneDropdown } from "~/app/[owner]/[repo]/_components/search/milestone-dropdown";
import {
    detectQualifier,
    replaceQualifierValue,
    SearchAutocomplete,
} from "~/app/[owner]/[repo]/_components/search/search-autocomplete";
import {
    addQualifier,
    formatQuery,
    hasQualifier,
    parseQuery,
    removeQualifier,
    replaceQualifier,
    splitQuery,
} from "~/app/[owner]/[repo]/_components/search/search-utils";
import { SortDropdown } from "~/app/[owner]/[repo]/_components/search/sort-dropdown";
import { Pagination } from "~/components/ui/pagination";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";
import { cn } from "~/lib/utils";
import type { PrSearchItem } from "~/server/api/routers/pulls/types";
import { api } from "~/trpc/react";
import type { PrRowData } from "./pull-request-row";
import { PullRequestRow } from "./pull-request-row";

type FilterState = "open" | "closed" | "merged";

const TABS: { key: FilterState; label: string }[] = [
    { key: "open", label: "Open" },
    { key: "closed", label: "Closed" },
    { key: "merged", label: "Merged" },
];

const PR_QUALIFIERS = [
    "author",
    "label",
    "assignee",
    "sort",
    "review",
    "status",
    "is",
];

const PR_AUTOCOMPLETE_OPTIONS: Record<
    string,
    { label: string; subtitle?: string }[]
> = {
    sort: [
        { label: "created-desc", subtitle: "Newest" },
        { label: "created-asc", subtitle: "Oldest" },
        { label: "updated-desc", subtitle: "Recently updated" },
        { label: "comments-desc", subtitle: "Most commented" },
    ],
    review: [
        { label: "none", subtitle: "Not reviewed" },
        { label: "required", subtitle: "Review required" },
        { label: "approved", subtitle: "Approved" },
        { label: "changes_requested", subtitle: "Changes requested" },
    ],
    status: [
        { label: "pending", subtitle: "Pending" },
        { label: "success", subtitle: "Success" },
        { label: "failure", subtitle: "Failure" },
    ],
    is: [
        { label: "open", subtitle: "Open pull requests" },
        { label: "closed", subtitle: "Closed pull requests" },
        { label: "merged", subtitle: "Merged pull requests" },
    ],
};

function computeStatusState(checks: Array<{ state: string }>): string | null {
    if (checks.length === 0) return null;
    if (
        checks.some(
            (c) =>
                c.state === "FAILURE" ||
                c.state === "ERROR" ||
                c.state === "TIMED_OUT",
        )
    ) {
        return "FAILURE";
    }
    if (
        checks.some(
            (c) =>
                c.state === "IN_PROGRESS" ||
                c.state === "QUEUED" ||
                c.state === "PENDING" ||
                c.state === "EXPECTED",
        )
    ) {
        return "IN_PROGRESS";
    }
    return "SUCCESS";
}

function normalizeSearchItem(item: PrSearchItem): PrRowData {
    return {
        id: item.id,
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
        assignee: item.assignees[0]
            ? {
                  login: item.assignees[0].login,
                  avatar_url: item.assignees[0].avatarUrl,
              }
            : null,
        labels: item.labels.map((l) => ({
            id: undefined,
            name: l.name,
            color: l.color,
            description: l.description,
        })),
        created_at: item.createdAt,
        merged_at: item.mergedAt,
        comments_count: item.comments,
        status_state: null,
        status_contexts: [],
        review_decision: item.reviewDecision,
    };
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
    const pageCursorsRef = useRef(pageCursors);
    pageCursorsRef.current = pageCursors;
    const [isResolving, setIsResolving] = useState(false);
    const prevQueryKey = useRef<string | undefined>(undefined);
    const utils = api.useUtils();

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
    let cleanedQuery = searchQuery;
    if (cleanedQuery) {
        const parsed = parseQuery(cleanedQuery);
        parsed.qualifiers = parsed.qualifiers.filter(
            (q) => q.key !== "sort" && q.key !== "is",
        );
        cleanedQuery = formatQuery(parsed);
    }
    const apiQuery = cleanedQuery
        ? `${stateQualifier} ${cleanedQuery}`
        : stateQualifier;

    // Always fetch exactly 30 items per page
    const after =
        currentPage > 1 ? (pageCursors[currentPage - 1] ?? null) : null;
    const first = 30;

    const { data, isLoading } = api.pulls.search.useQuery(
        {
            provider: "gh",
            owner,
            repo,
            query: apiQuery,
            page: currentPage,
            after: after ?? undefined,
            first,
            sort: currentSort,
            order: currentOrder,
        },
        { enabled: !isResolving },
    );

    const showLoading = isLoading || isResolving;

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

    // When jumping to a page whose cursor isn't cached, resolve the cursor chain
    // by sequentially fetching intermediate pages
    useEffect(() => {
        if (currentPage <= 1) return;
        if (pageCursorsRef.current[currentPage - 1]) return;

        let cancelled = false;

        async function resolveCursors() {
            setIsResolving(true);
            let cursor: string | null = null;

            for (let page = 1; page < currentPage; page++) {
                if (cancelled) return;

                try {
                    const result = await utils.pulls.search.fetch({
                        provider: "gh",
                        owner,
                        repo,
                        query: apiQuery,
                        after: cursor ?? undefined,
                        first: 30,
                        sort: currentSort,
                        order: currentOrder,
                    });

                    if (cancelled) return;

                    const newCursor = result?.endCursor;
                    if (newCursor) {
                        setPageCursors((prev) => ({
                            ...prev,
                            [page]: newCursor,
                        }));
                    }
                    cursor = newCursor ?? null;

                    if (!result?.hasNextPage) break;
                } catch {
                    break;
                }
            }

            if (!cancelled) {
                setIsResolving(false);
            }
        }

        resolveCursors();

        return () => {
            cancelled = true;
        };
    }, [
        currentPage,
        apiQuery,
        owner,
        repo,
        currentSort,
        currentOrder,
        utils.pulls.search.fetch,
    ]);

    const prNumbers = useMemo(
        () => (data?.items ?? []).map((i) => i.number),
        [data],
    );

    const { data: statusByPr } = api.checks.listByPrNumbers.useQuery(
        { owner, repo, prNumbers },
        { enabled: prNumbers.length > 0 },
    );

    const items = useMemo(() => {
        if (!data) return [];
        return data.items.map((item) => {
            const normalized = normalizeSearchItem(item);
            const checks = statusByPr?.[item.number];
            if (checks) {
                normalized.status_contexts = checks;
                normalized.status_state = computeStatusState(checks);
            }
            return normalized;
        });
    }, [data, statusByPr]);
    const stateCounts = data?.stateCounts;
    const totalPages = Math.ceil((data?.totalCount ?? 0) / 30);

    const navigate = useCallback(
        (changes: Record<string, string | null>) => {
            const params = new URLSearchParams(searchParams.toString());
            for (const [key, value] of Object.entries(changes)) {
                if (value === null) params.delete(key);
                else params.set(key, value);
            }
            window.scrollTo({ top: 0, behavior: "smooth" });
            router.push(`/gh/${owner}/${repo}/pulls?${params.toString()}`);
        },
        [owner, repo, router, searchParams],
    );

    const [searchInput, setSearchInput] = useState(searchQuery);

    // Sync searchInput from URL when it changes externally (e.g., browser nav)
    useEffect(() => {
        setSearchInput(searchQuery);
    }, [searchQuery]);

    const setTab = useCallback(
        (tab: FilterState) => {
            const parsed = parseQuery(searchInput);
            parsed.qualifiers = parsed.qualifiers.filter((q) => q.key !== "is");
            if (tab !== "open") {
                parsed.qualifiers.push({ key: "is", value: tab });
            }
            const newQuery = formatQuery(parsed);
            const withSpace = newQuery ? `${newQuery} ` : newQuery;
            setSearchInput(withSpace);
            navigate({
                state: tab === "open" ? null : tab,
                q: withSpace || null,
                page: null,
            });
        },
        [navigate, searchInput],
    );

    const handleSearch = useCallback(() => {
        const parsed = parseQuery(searchInput);
        const isQualifier = parsed.qualifiers.find((q) => q.key === "is");
        const params = new URLSearchParams(searchParams.toString());
        if (isQualifier) {
            const tab = isQualifier.value as FilterState;
            if (tab === "open") {
                params.delete("state");
                parsed.qualifiers = parsed.qualifiers.filter(
                    (q) => q.key !== "is",
                );
                const newQuery = formatQuery(parsed);
                if (newQuery) params.set("q", newQuery);
                else params.delete("q");
                setSearchInput(newQuery);
            } else {
                params.set("state", tab);
                if (searchInput) params.set("q", searchInput);
                else params.delete("q");
            }
            params.delete("page");
            router.push(`/gh/${owner}/${repo}/pulls?${params.toString()}`);
        } else {
            if (searchInput) params.set("q", searchInput);
            else params.delete("q");
            params.delete("page");
            router.push(`/gh/${owner}/${repo}/pulls?${params.toString()}`);
        }
    }, [searchInput, searchParams, router, owner, repo]);

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

    // Autocomplete state
    const inputRef = useRef<HTMLInputElement>(null);
    const searchBarRef = useRef<HTMLDivElement>(null);
    const autocompleteRef = useRef<{
        handleKeyDown: (e: React.KeyboardEvent) => boolean;
    }>(null);
    const [cursorPos, setCursorPos] = useState(0);
    const autocompleteMatch = detectQualifier(
        searchInput,
        cursorPos,
        PR_QUALIFIERS,
    );

    // Close autocomplete when clicking outside the search bar
    useEffect(() => {
        if (!autocompleteMatch) return;
        const handler = (e: MouseEvent) => {
            if (
                searchBarRef.current &&
                !searchBarRef.current.contains(e.target as Node)
            ) {
                setCursorPos(0);
            }
        };
        requestAnimationFrame(() => {
            document.addEventListener("mousedown", handler);
        });
        return () => document.removeEventListener("mousedown", handler);
    }, [autocompleteMatch]);

    const handleAutocompleteSelect = useCallback(
        (key: string, value: string) => {
            if (key === "is") {
                const tab = value as FilterState;
                const parsed = parseQuery(searchInput);
                parsed.qualifiers = parsed.qualifiers.filter(
                    (q) => q.key !== "is",
                );
                if (tab !== "open") {
                    parsed.qualifiers.push({ key: "is", value: tab });
                }
                const newQuery = formatQuery(parsed);
                const withSpace = newQuery ? `${newQuery} ` : newQuery;
                setSearchInput(withSpace);
                setCursorPos(withSpace ? withSpace.length : 0);
                navigate({
                    state: tab === "open" ? null : tab,
                    q: withSpace || null,
                    page: null,
                });
                return;
            }
            const newQuery = replaceQualifierValue(
                searchInput,
                cursorPos,
                key,
                value,
            );
            setSearchInput(newQuery);
            setCursorPos(0);
            if (key === "sort") {
                const [sort, order] = value.split("-") as [
                    "created" | "updated" | "comments",
                    "asc" | "desc",
                ];
                navigate({ q: newQuery || null, sort, order, page: null });
            } else {
                navigate({ q: newQuery || null, page: null });
            }
        },
        [searchInput, cursorPos, navigate],
    );

    const handleAutocompleteClose = useCallback(() => {
        setCursorPos(0);
    }, []);

    return (
        <div>
            <div className="border-gray-200 border-b dark:border-zinc-800">
                <div className="flex items-center gap-1 px-4 py-2">
                    <div
                        ref={searchBarRef}
                        className="relative flex flex-1 items-center"
                    >
                        <div
                            className="pointer-events-none absolute inset-0 flex items-center px-3 py-1.5 text-sm"
                            aria-hidden="true"
                        >
                            {searchInput ? (
                                <span className="whitespace-nowrap">
                                    {splitQuery(searchInput).map((seg, i) => {
                                        const key = `${seg.text}-${seg.isQualifier ? "q" : "t"}-${i}`;
                                        return seg.isQualifier ? (
                                            <span
                                                key={key}
                                                className="rounded bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300"
                                            >
                                                {seg.text}
                                            </span>
                                        ) : (
                                            <span
                                                key={key}
                                                className="text-gray-900 dark:text-gray-100"
                                            >
                                                {seg.text}
                                            </span>
                                        );
                                    })}
                                </span>
                            ) : null}
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchInput}
                            onChange={(e) => {
                                setSearchInput(e.target.value);
                                setCursorPos(e.target.selectionStart ?? 0);
                            }}
                            onKeyDown={(e) => {
                                if (
                                    autocompleteMatch &&
                                    autocompleteRef.current?.handleKeyDown(e)
                                ) {
                                    return;
                                }
                                if (e.key === "Enter" && !e.defaultPrevented) {
                                    e.preventDefault();
                                    handleSearch();
                                }
                            }}
                            onClick={(e) => {
                                setCursorPos(
                                    e.currentTarget.selectionStart ?? 0,
                                );
                            }}
                            onSelect={(e) => {
                                setCursorPos(
                                    e.currentTarget.selectionStart ?? 0,
                                );
                            }}
                            placeholder="Search pull requests by title, body, or comments"
                            className="relative w-full rounded-md border border-gray-300 bg-transparent px-3 py-1.5 pr-12 text-sm text-transparent placeholder-gray-500 caret-gray-900 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:placeholder-gray-500 dark:caret-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                        />
                        {autocompleteMatch && (
                            <SearchAutocomplete
                                ref={autocompleteRef}
                                owner={owner}
                                repo={repo}
                                provider="gh"
                                match={autocompleteMatch}
                                query={autocompleteMatch.value}
                                staticOptions={PR_AUTOCOMPLETE_OPTIONS}
                                onSelect={handleAutocompleteSelect}
                                onClose={handleAutocompleteClose}
                            />
                        )}
                        <div className="absolute right-2 flex items-center gap-0.5">
                            {searchInput && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchInput("");
                                        navigate({ q: null, page: null });
                                    }}
                                    className="flex size-4 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    <X className="size-3" />
                                </button>
                            )}
                            <button
                                type="button"
                                aria-label="Search"
                                onClick={handleSearch}
                                className="flex size-6 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-gray-300"
                            >
                                <Search className="size-4" />
                            </button>
                        </div>
                    </div>

                    <a
                        href={`https://github.com/${owner}/${repo}/labels`}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800"
                    >
                        <Tag className="size-4" />
                        Labels
                    </a>

                    <a
                        href={`https://github.com/${owner}/${repo}/milestones`}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800"
                    >
                        <Milestone className="size-4" />
                        Milestones
                    </a>

                    <a
                        href={`https://github.com/${owner}/${repo}/compare`}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-green-600 bg-green-600 px-2.5 py-1.5 font-medium text-sm text-white transition-colors hover:bg-green-700 dark:border-green-500 dark:bg-green-600 dark:hover:bg-green-700"
                    >
                        <GitPullRequest className="size-4" />
                        New Pull Request
                    </a>
                </div>
            </div>

            <div className="border-gray-200 border-b dark:border-zinc-800">
                <div className="flex items-center justify-between px-4">
                    <div className="flex items-center">
                        {TABS.map((tab) => {
                            const count =
                                tab.key !== "merged"
                                    ? stateCounts?.[tab.key]
                                    : undefined;
                            return (
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
                                    {count !== undefined && (
                                        <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs tabular-nums dark:bg-zinc-700">
                                            {count.toLocaleString()}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-2">
                        <AuthorDropdown
                            provider="gh"
                            owner={owner}
                            repo={repo}
                            currentQuery={searchQuery}
                            onToggle={(key: string, value: string) => {
                                const newQuery = hasQualifier(
                                    searchQuery,
                                    key,
                                    value,
                                )
                                    ? removeQualifier(searchQuery, key, value)
                                    : replaceQualifier(searchQuery, key, value);
                                setSearchInput(newQuery);
                                navigate({
                                    q: newQuery || null,
                                    page: null,
                                });
                            }}
                        />

                        <LabelDropdown
                            provider="gh"
                            owner={owner}
                            repo={repo}
                            currentQuery={searchQuery}
                            onToggle={(labelName: string) => {
                                if (
                                    hasQualifier(
                                        searchQuery,
                                        "label",
                                        labelName,
                                    )
                                ) {
                                    handleRemoveQualifier("label", labelName);
                                } else {
                                    handleAddQualifier("label", labelName);
                                }
                            }}
                        />

                        <MilestoneDropdown
                            provider="gh"
                            owner={owner}
                            repo={repo}
                            currentQuery={searchQuery}
                            onToggle={(milestone: string) => {
                                const quoted = `"${milestone}"`;
                                if (
                                    hasQualifier(
                                        searchQuery,
                                        "milestone",
                                        quoted,
                                    )
                                ) {
                                    handleRemoveQualifier("milestone", quoted);
                                } else {
                                    handleAddQualifier("milestone", quoted);
                                }
                            }}
                        />

                        <AssigneeDropdown
                            provider="gh"
                            owner={owner}
                            repo={repo}
                            currentQuery={searchQuery}
                            onToggle={(key: string, value: string) => {
                                const newQuery = hasQualifier(
                                    searchQuery,
                                    key,
                                    value,
                                )
                                    ? removeQualifier(searchQuery, key, value)
                                    : replaceQualifier(searchQuery, key, value);
                                setSearchInput(newQuery);
                                navigate({
                                    q: newQuery || null,
                                    page: null,
                                });
                            }}
                        />

                        <StatusDropdown
                            currentQuery={searchQuery}
                            onToggle={(key: string, value: string) => {
                                const newQuery = hasQualifier(
                                    searchQuery,
                                    key,
                                    value,
                                )
                                    ? removeQualifier(searchQuery, key, value)
                                    : replaceQualifier(searchQuery, key, value);
                                setSearchInput(newQuery);
                                navigate({
                                    q: newQuery || null,
                                    page: null,
                                });
                            }}
                        />

                        <ReviewDropdown
                            currentQuery={searchQuery}
                            onToggle={(key: string, value: string) => {
                                const newQuery = hasQualifier(
                                    searchQuery,
                                    key,
                                    value,
                                )
                                    ? removeQualifier(searchQuery, key, value)
                                    : replaceQualifier(searchQuery, key, value);
                                setSearchInput(newQuery);
                                navigate({
                                    q: newQuery || null,
                                    page: null,
                                });
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
                {showLoading ? (
                    <div className="space-y-0">
                        {["sk1", "sk2", "sk3", "sk4", "sk5"].map((id) => (
                            <div
                                key={id}
                                className="flex items-start gap-3 border-gray-200 border-b px-4 py-3 dark:border-zinc-800"
                            >
                                <div className="mt-0.5 size-4 shrink-0 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                                        <div className="size-4 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div className="h-3 w-32 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                                        <div className="h-3 w-20 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        <div className="h-5 w-12 animate-pulse rounded-full bg-gray-200 dark:bg-zinc-700" />
                                        <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200 dark:bg-zinc-700" />
                                    </div>
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
                                provider="gh"
                                pr={pr}
                                owner={owner}
                                repo={repo}
                                onLabelFilter={(name) => {
                                    const newQuery = hasQualifier(
                                        searchQuery,
                                        "label",
                                        name,
                                    )
                                        ? removeQualifier(
                                              searchQuery,
                                              "label",
                                              name,
                                          )
                                        : addQualifier(
                                              searchQuery,
                                              "label",
                                              name,
                                          );
                                    setSearchInput(newQuery);
                                    navigate({
                                        q: newQuery || null,
                                        page: null,
                                    });
                                }}
                                onAuthorFilter={(login) => {
                                    const newQuery = hasQualifier(
                                        searchQuery,
                                        "author",
                                        login,
                                    )
                                        ? removeQualifier(
                                              searchQuery,
                                              "author",
                                              login,
                                          )
                                        : replaceQualifier(
                                              searchQuery,
                                              "author",
                                              login,
                                          );
                                    setSearchInput(newQuery);
                                    navigate({
                                        q: newQuery || null,
                                        page: null,
                                    });
                                }}
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
                                        : replaceQualifier(
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

            {!showLoading && items.length > 0 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={(page) => navigate({ page: String(page) })}
                />
            )}
        </div>
    );
}

function StatusDropdown({
    currentQuery,
    onToggle,
}: {
    currentQuery: string;
    onToggle: (key: string, value: string) => void;
}) {
    const STATUS_OPTIONS = [
        { label: "pending", subtitle: "Pending" },
        { label: "success", subtitle: "Success" },
        { label: "failure", subtitle: "Failure" },
    ];

    return (
        <SearchableDropdown
            items={STATUS_OPTIONS}
            isSelected={(o: { label: string }) =>
                hasQualifier(currentQuery, "status", o.label)
            }
            onSelect={(o: { label: string }) => onToggle("status", o.label)}
            keyFn={(o: { label: string }) => o.label}
            searchFn={(o: { label: string }, q: string) =>
                o.label.toLowerCase().includes(q.toLowerCase())
            }
            renderItem={(
                o: { label: string; subtitle: string },
                selected: boolean,
            ) => (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate">{o.label}</span>
                    {selected && (
                        <span className="ml-auto shrink-0 text-blue-600 text-xs dark:text-blue-400">
                            &#10003;
                        </span>
                    )}
                </div>
            )}
            placeholder="Filter status..."
            emptyText="No status options"
            ariaLabel="Filter by status"
            closeOnSelect
            trigger={
                <button
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800"
                >
                    <CircleCheck className="size-4" />
                    Checks
                    <ChevronDown className="size-3.5 text-gray-400" />
                </button>
            }
        />
    );
}

function ReviewDropdown({
    currentQuery,
    onToggle,
}: {
    currentQuery: string;
    onToggle: (key: string, value: string) => void;
}) {
    const REVIEW_OPTIONS = [
        { label: "none", subtitle: "Not reviewed" },
        { label: "required", subtitle: "Review required" },
        { label: "approved", subtitle: "Approved" },
        { label: "changes_requested", subtitle: "Changes requested" },
    ];

    return (
        <SearchableDropdown
            items={REVIEW_OPTIONS}
            isSelected={(o: { label: string }) =>
                hasQualifier(currentQuery, "review", o.label)
            }
            onSelect={(o: { label: string }) => onToggle("review", o.label)}
            keyFn={(o: { label: string }) => o.label}
            searchFn={(o: { label: string }, q: string) =>
                o.label.toLowerCase().includes(q.toLowerCase())
            }
            renderItem={(
                o: { label: string; subtitle: string },
                selected: boolean,
            ) => (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate">{o.subtitle ?? o.label}</span>
                    {selected && (
                        <span className="ml-auto shrink-0 text-blue-600 text-xs dark:text-blue-400">
                            &#10003;
                        </span>
                    )}
                </div>
            )}
            placeholder="Filter review..."
            emptyText="No review options"
            ariaLabel="Filter by review"
            closeOnSelect
            trigger={
                <button
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800"
                >
                    <Eye className="size-4" />
                    Review
                    <ChevronDown className="size-3.5 text-gray-400" />
                </button>
            }
        />
    );
}
