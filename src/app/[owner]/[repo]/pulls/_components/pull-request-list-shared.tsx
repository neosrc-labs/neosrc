"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    detectQualifier,
    replaceQualifierValue,
} from "~/app/[owner]/[repo]/_components/search/search-autocomplete";
import {
    addQualifier,
    formatQuery,
    hasQualifier,
    parseQuery,
    removeQualifier,
    replaceQualifier,
} from "~/app/[owner]/[repo]/_components/search/search-utils";
import type { PrRowData } from "~/app/gh/[owner]/[repo]/pulls/_components/pull-request-row";
import { PullRequestRow } from "~/app/gh/[owner]/[repo]/pulls/_components/pull-request-row";
import { Pagination } from "~/components/ui/pagination";
import type { PrSearchItem } from "~/server/api/routers/pulls/types";
import { api } from "~/trpc/react";
import { PullRequestEmptyState } from "./pull-request-empty-state";
import type {
    FilterState,
    PullRequestListConfig,
} from "./pull-request-list-config";
import { PullRequestSearchBar } from "./pull-request-search-bar";
import { PullRequestSkeleton } from "./pull-request-skeleton";
import { PullRequestToolbar } from "./pull-request-toolbar";

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
            ? { login: item.author.login, avatar_url: item.author.avatarUrl }
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

export function PullRequestListShared({
    owner,
    repo,
    defaultState,
    config,
}: {
    owner: string;
    repo: string;
    defaultState: FilterState;
    config: PullRequestListConfig;
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

    const after =
        currentPage > 1 ? (pageCursors[currentPage - 1] ?? null) : null;
    const first = 30;

    const { data, isLoading } = api.pulls.search.useQuery(
        {
            provider: config.provider,
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

    useEffect(() => {
        const cursor = data?.endCursor;
        if (cursor) {
            setPageCursors((prev) => ({
                ...prev,
                [currentPage]: cursor,
            }));
        }
    }, [data?.endCursor, currentPage]);

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
                        provider: config.provider,
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
        config.provider,
    ]);

    const prNumbers = useMemo(
        () => (data?.items ?? []).map((i) => i.number),
        [data],
    );

    const { data: statusByPr } = api.checks.listByPrNumbers.useQuery(
        { owner, repo, prNumbers },
        { enabled: config.fetchStatusChecks && prNumbers.length > 0 },
    );

    const items = useMemo(() => {
        if (!data) return [];
        return data.items.map((item) => {
            const normalized = normalizeSearchItem(item);
            if (config.fetchStatusChecks) {
                const checks = statusByPr?.[item.number];
                if (checks) {
                    normalized.status_contexts = checks;
                    normalized.status_state = computeStatusState(checks);
                }
            }
            return normalized;
        });
    }, [data, statusByPr, config.fetchStatusChecks]);

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
            router.push(
                `${config.basePath}/${owner}/${repo}/pulls?${params.toString()}`,
            );
        },
        [owner, repo, router, searchParams, config.basePath],
    );

    const [searchInput, setSearchInput] = useState(searchQuery);

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
            router.push(
                `${config.basePath}/${owner}/${repo}/pulls?${params.toString()}`,
            );
        } else {
            if (searchInput) params.set("q", searchInput);
            else params.delete("q");
            params.delete("page");
            router.push(
                `${config.basePath}/${owner}/${repo}/pulls?${params.toString()}`,
            );
        }
    }, [searchInput, searchParams, router, owner, repo, config.basePath]);

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

    const inputRef = useRef<HTMLInputElement>(null);
    const searchBarRef = useRef<HTMLDivElement>(null);
    const autocompleteRef = useRef<{
        handleKeyDown: (e: React.KeyboardEvent) => boolean;
    }>(null);
    const [cursorPos, setCursorPos] = useState(0);
    const autocompleteMatch = detectQualifier(
        searchInput,
        cursorPos,
        config.qualifiers,
    );

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

    const handleClearSearch = useCallback(() => {
        setSearchInput("");
        navigate({ q: null, page: null });
    }, [navigate]);

    return (
        <div>
            <PullRequestSearchBar
                searchInput={searchInput}
                setSearchInput={setSearchInput}
                cursorPos={cursorPos}
                setCursorPos={setCursorPos}
                inputRef={inputRef}
                searchBarRef={searchBarRef}
                autocompleteRef={autocompleteRef}
                config={config}
                owner={owner}
                repo={repo}
                onSearch={handleSearch}
                onClear={handleClearSearch}
                onAutocompleteSelect={handleAutocompleteSelect}
            />

            <PullRequestToolbar
                activeTab={activeTab}
                searchQuery={searchQuery}
                setSearchInput={setSearchInput}
                currentSort={currentSort}
                currentOrder={currentOrder}
                config={config}
                owner={owner}
                repo={repo}
                stateCounts={stateCounts}
                onTabChange={setTab}
                onNavigate={navigate}
                onAddQualifier={handleAddQualifier}
                onRemoveQualifier={handleRemoveQualifier}
            />

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
                    <PullRequestSkeleton />
                ) : items.length === 0 ? (
                    <PullRequestEmptyState
                        searchQuery={searchQuery}
                        activeTab={activeTab}
                    />
                ) : (
                    <div>
                        {items.map((pr) => (
                            <PullRequestRow
                                key={pr.id}
                                provider={config.provider}
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
