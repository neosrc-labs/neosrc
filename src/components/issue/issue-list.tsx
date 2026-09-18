"use client";

import { Plus } from "lucide-react";
import { useCallback, useMemo } from "react";
import { ListSearchBar } from "~/components/list/list-search-bar";
import { ListSkeleton } from "~/components/list/list-skeleton";
import { rowQualifierFilters } from "~/components/list/row-qualifier-filters";
import { SearchListLayout } from "~/components/list/search-list-layout";
import {
    type SearchArgs,
    useSearchList,
} from "~/components/list/use-search-list";
import type { IssueSearchItem } from "~/server/api/routers/issues/types";
import { api } from "~/trpc/react";
import { booleanSearchHint } from "~/utils/search-syntax";
import { IssueEmptyState } from "./issue-empty-state";
import { buildIssueConfig } from "./issue-list-config";
import type { IssueRowData } from "./issue-row";
import { IssueRow } from "./issue-row";
import { IssueToolbar } from "./issue-toolbar";

function normalizeSearchItem(item: IssueSearchItem): IssueRowData {
    const assigneeNode = item.assignees[0];
    return {
        number: item.number,
        title: item.title,
        state: item.state.toLowerCase(),
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
        labels: item.labels.map((l) => ({
            name: l.name,
            color: l.color,
            description: l.description,
        })),
        created_at: item.createdAt,
        closed_at: item.closedAt,
        comments_count: item.comments,
    };
}

function useIssueSearchQuery(args: SearchArgs, opts?: { enabled?: boolean }) {
    const live = api.issues.search.useQuery(args, {
        ...opts,
        staleTime: 0,
        refetchOnMount: "always",
        placeholderData: () => undefined,
    });
    const cached = api.issues.searchCached.useQuery(args, {
        ...opts,
        staleTime: 0,
        refetchOnMount: "always",
        placeholderData: () => undefined,
    });

    return {
        data: live.data,
        cachedData: cached.data,
        isLoading: live.isLoading,
        isFetching: live.isFetching,
        isError: live.isError,
        isPaused: live.isPaused,
    };
}

export function IssueList({
    provider = "gh",
    owner,
    repo,
    defaultState,
}: {
    provider?: "gh" | "cb";
    owner: string;
    repo: string;
    defaultState: "open" | "closed";
}) {
    const utils = api.useUtils();
    const searchFetch = useCallback(
        (args: SearchArgs) => utils.issues.search.fetch(args),
        [utils],
    );
    const config = buildIssueConfig(provider, owner, repo);

    const list = useSearchList<IssueSearchItem>(
        {
            ...config,
            owner,
            repo,
            defaultState,
        },
        {
            useSearchQuery: useIssueSearchQuery,
            searchFetch,
        },
    );

    const items = useMemo(
        () => (list.data?.items ?? []).map(normalizeSearchItem),
        [list.data],
    );

    const filters = rowQualifierFilters(list);
    const booleanHint = booleanSearchHint(provider, list.searchQuery);

    return (
        <SearchListLayout
            searchBar={
                <ListSearchBar
                    searchInput={list.searchInput}
                    setSearchInput={list.setSearchInput}
                    cursorPos={list.cursorPos}
                    setCursorPos={list.setCursorPos}
                    inputRef={list.inputRef}
                    searchBarRef={list.searchBarRef}
                    autocompleteRef={list.autocompleteRef}
                    provider={config.provider}
                    qualifiers={config.qualifiers}
                    autocompleteOptions={config.autocompleteOptions}
                    owner={owner}
                    repo={repo}
                    placeholder="Search issues by title, body, or comments"
                    urls={config.externalUrls}
                    newItemIcon={<Plus className="size-4" />}
                    newItemLabel="New Issue"
                    onSearch={list.handleSearch}
                    onClear={list.handleClearSearch}
                    onAutocompleteSelect={list.handleAutocompleteSelect}
                    booleanHint={booleanHint}
                />
            }
            toolbar={
                <IssueToolbar
                    activeTab={list.activeTab}
                    searchQuery={list.searchQuery}
                    setSearchInput={list.setSearchInput}
                    currentSort={list.currentSort}
                    currentOrder={list.currentOrder}
                    provider={config.provider}
                    owner={owner}
                    repo={repo}
                    stateCounts={list.stateCounts}
                    onTabChange={list.setTab}
                    onNavigate={list.navigate}
                    onAddQualifier={list.handleAddQualifier}
                    onRemoveQualifier={list.handleRemoveQualifier}
                />
            }
            showLoading={list.showLoading}
            refreshStatus={list.refreshStatus}
            isEmpty={items.length === 0}
            skeleton={<ListSkeleton />}
            emptyState={
                <IssueEmptyState
                    searchQuery={list.searchQuery}
                    activeTab={list.activeTab}
                />
            }
            rows={
                <div>
                    {items.map((issue) => (
                        <IssueRow
                            key={issue.number}
                            issue={issue}
                            provider={provider}
                            owner={owner}
                            repo={repo}
                            onLabelFilter={filters.onLabelFilter}
                            onAuthorFilter={filters.onAuthorFilter}
                            onAssigneesFilter={filters.onAssigneesFilter}
                        />
                    ))}
                </div>
            }
            currentPage={list.currentPage}
            totalPages={list.totalPages}
            onPageChange={(page) => list.navigate({ page: String(page) })}
        />
    );
}
