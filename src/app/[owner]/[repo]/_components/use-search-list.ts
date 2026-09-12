"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    detectQualifier,
    replaceQualifierValue,
} from "~/app/[owner]/[repo]/_components/search/search-autocomplete";
import {
    addQualifier,
    getQualifierValue,
    removeQualifier,
    removeQualifiersByKey,
} from "~/app/[owner]/[repo]/_components/search/search-utils";

export interface SearchArgs {
    provider: "gh" | "cb";
    owner: string;
    repo: string;
    query: string;
    page?: number;
    after?: string;
    first?: number;
    sort?: "created" | "updated" | "comments";
    order?: "asc" | "desc";
}

export interface SearchResultData<TItem> {
    items: TItem[];
    totalCount: number;
    hasNextPage: boolean;
    endCursor: string | null;
    stateCounts: Record<string, number>;
}

export interface UseSearchListConfig {
    provider: "gh" | "cb";
    baseRoute: string;
    owner: string;
    repo: string;
    defaultState: string;
    qualifiers: string[];
    autocompleteOptions: Record<string, { label: string; subtitle?: string }[]>;
    stateQualifierFn: (activeTab: string) => string;
}

export interface SearchListResult<TItem> {
    activeTab: string;
    currentPage: number;
    searchQuery: string;
    currentSort: string;
    currentOrder: string;
    apiQuery: string;
    showLoading: boolean;
    stateCounts: Record<string, number> | undefined;
    totalPages: number;
    data: SearchResultData<TItem> | undefined;
    searchInput: string;
    setSearchInput: (value: string) => void;
    cursorPos: number;
    setCursorPos: (value: number) => void;
    inputRef: React.RefObject<HTMLInputElement | null>;
    searchBarRef: React.RefObject<HTMLDivElement | null>;
    autocompleteRef: React.RefObject<{
        handleKeyDown: (e: React.KeyboardEvent) => boolean;
    } | null>;
    autocompleteMatch: ReturnType<typeof detectQualifier> | null;
    navigate: (changes: Record<string, string | null>) => void;
    setTab: (tab: string) => void;
    handleSearch: () => void;
    handleRemoveQualifier: (key: string, value: string) => void;
    handleAddQualifier: (key: string, value: string) => void;
    handleAutocompleteSelect: (key: string, value: string) => void;
    handleClearSearch: () => void;
}

export function useSearchList<TItem>(
    config: UseSearchListConfig,
    procedures: {
        useSearchQuery: (
            args: SearchArgs,
            opts?: { enabled?: boolean },
        ) => {
            data?: SearchResultData<TItem>;
            isLoading: boolean;
        };
        searchFetch: (args: SearchArgs) => Promise<SearchResultData<TItem>>;
    },
): SearchListResult<TItem> {
    const searchParams = useSearchParams();
    const router = useRouter();

    const activeTab = searchParams.get("state") ?? config.defaultState;
    const currentPage = parseInt(searchParams.get("page") ?? "1", 10);
    const searchQuery = searchParams.get("q") ?? "";
    const sortParam = searchParams.get("sort");
    const currentSort =
        sortParam === "updated" || sortParam === "comments"
            ? sortParam
            : "created";
    const orderParam = searchParams.get("order");
    const currentOrder = orderParam === "asc" ? "asc" : "desc";

    // Cursors are opaque tokens bound to the repository and provider as well as
    // the query, so all of them key the cached cursor.
    const queryKey = `${config.provider}:${config.owner}:${config.repo}:${activeTab}:${searchQuery}:${currentSort}:${currentOrder}`;
    const [cursorState, setCursorState] = useState<{
        key: string;
        cursors: Record<number, string>;
    }>(() => ({ key: queryKey, cursors: {} }));
    // Page cursors are pagination tokens tied to one query. Deriving them from
    // the stored key guarantees a token from a previous query is never sent
    // with a new one, without resetting state during render.
    const pageCursors = useMemo(
        () => (cursorState.key === queryKey ? cursorState.cursors : {}),
        [cursorState, queryKey],
    );
    const setPageCursors = useCallback(
        (update: (prev: Record<number, string>) => Record<number, string>) => {
            setCursorState((prev) => ({
                key: queryKey,
                cursors: update(prev.key === queryKey ? prev.cursors : {}),
            }));
        },
        [queryKey],
    );
    const pageCursorsRef = useRef(pageCursors);
    const [isResolving, setIsResolving] = useState(false);

    // Effects below read the ref, so sync it before they run.
    useEffect(() => {
        pageCursorsRef.current = pageCursors;
    }, [pageCursors]);

    const stateQualifier = config.stateQualifierFn(activeTab);
    // The backend state and sort come from the URL, so drop any the query
    // carries while leaving the rest of the query order untouched.
    const cleanedQuery = searchQuery
        ? removeQualifiersByKey(searchQuery, ["sort", "is"])
        : "";
    const apiQuery = cleanedQuery
        ? `${stateQualifier} ${cleanedQuery}`
        : stateQualifier;

    const after =
        currentPage > 1 ? (pageCursors[currentPage - 1] ?? null) : null;
    const first = 30;

    const searchArgs: SearchArgs = {
        provider: config.provider,
        owner: config.owner,
        repo: config.repo,
        query: apiQuery,
        page: currentPage,
        after: after ?? undefined,
        first,
        sort: currentSort,
        order: currentOrder,
    };

    const searchResult = procedures.useSearchQuery(searchArgs, {
        enabled: !isResolving,
    });
    const { data, isLoading } = searchResult;
    const showLoading = isLoading || isResolving;

    useEffect(() => {
        const cursor = data?.endCursor;
        if (cursor) {
            setPageCursors((prev) => ({
                ...prev,
                [currentPage]: cursor,
            }));
        }
    }, [data?.endCursor, currentPage, setPageCursors]);

    const searchFetch = procedures.searchFetch;

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
                    const fetchArgs: SearchArgs = {
                        provider: config.provider,
                        owner: config.owner,
                        repo: config.repo,
                        query: apiQuery,
                        after: cursor ?? undefined,
                        first: 30,
                        sort: currentSort,
                        order: currentOrder,
                    };
                    const result = await searchFetch(fetchArgs);

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
        config.provider,
        config.owner,
        config.repo,
        currentSort,
        currentOrder,
        searchFetch,
        setPageCursors,
    ]);

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
            router.push(`${config.baseRoute}?${params.toString()}`);
        },
        [config.baseRoute, router, searchParams],
    );

    const [searchInput, setSearchInput] = useState(searchQuery);

    useEffect(() => {
        setSearchInput(searchQuery);
    }, [searchQuery]);

    const setTab = useCallback(
        (tab: string) => {
            const withoutState = removeQualifiersByKey(searchInput, ["is"]);
            const newQuery =
                tab === "open"
                    ? withoutState
                    : addQualifier(withoutState, "is", tab);
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
        const stateValue = getQualifierValue(searchInput, "is");
        const params = new URLSearchParams(searchParams.toString());
        if (stateValue) {
            if (stateValue === "open") {
                params.delete("state");
                const newQuery = removeQualifiersByKey(searchInput, ["is"]);
                if (newQuery) params.set("q", newQuery);
                else params.delete("q");
                setSearchInput(newQuery);
            } else {
                params.set("state", stateValue);
                if (searchInput) params.set("q", searchInput);
                else params.delete("q");
            }
            params.delete("page");
            router.push(`${config.baseRoute}?${params.toString()}`);
        } else {
            if (searchInput) params.set("q", searchInput);
            else params.delete("q");
            params.delete("page");
            router.push(`${config.baseRoute}?${params.toString()}`);
        }
    }, [searchInput, searchParams, router, config.baseRoute]);

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
                const tab = value;
                const withoutState = removeQualifiersByKey(searchInput, ["is"]);
                const newQuery =
                    tab === "open"
                        ? withoutState
                        : addQualifier(withoutState, "is", tab);
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
                config.qualifiers,
            );
            setSearchInput(newQuery);
            setCursorPos(0);
            if (key === "sort") {
                const [sort = "created", order = "desc"] = value.split("-");
                navigate({ q: newQuery || null, sort, order, page: null });
            } else {
                navigate({ q: newQuery || null, page: null });
            }
        },
        [searchInput, cursorPos, navigate, config.qualifiers],
    );

    const handleClearSearch = useCallback(() => {
        setSearchInput("");
        navigate({ q: null, page: null });
    }, [navigate]);

    return {
        activeTab,
        currentPage,
        searchQuery,
        currentSort,
        currentOrder,
        apiQuery,
        showLoading,
        stateCounts,
        totalPages,
        data,
        searchInput,
        setSearchInput,
        cursorPos,
        setCursorPos,
        inputRef,
        searchBarRef,
        autocompleteRef,
        autocompleteMatch,
        navigate,
        setTab,
        handleSearch,
        handleRemoveQualifier,
        handleAddQualifier,
        handleAutocompleteSelect,
        handleClearSearch,
    };
}
