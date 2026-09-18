"use client";

import { GitPullRequest } from "lucide-react";
import { useCallback, useMemo } from "react";
import { computeStatusState } from "~/components/ci-status";
import { ListSearchBar } from "~/components/list/list-search-bar";
import { ListSkeleton } from "~/components/list/list-skeleton";
import { rowQualifierFilters } from "~/components/list/row-qualifier-filters";
import { SearchListLayout } from "~/components/list/search-list-layout";
import {
    type SearchArgs,
    useSearchList,
} from "~/components/list/use-search-list";
import { RecentlyPushedBanner } from "~/components/repo/recently-pushed-banner";
import type { PrSearchItem } from "~/server/api/routers/pulls/types";
import { api } from "~/trpc/react";
import { PullRequestEmptyState } from "./pull-request-empty-state";
import {
    type FilterState,
    type PullRequestListConfig,
    pullRequestExternalUrls,
} from "./pull-request-list-config";
import type { PrRowData } from "./pull-request-row";
import { PullRequestRow } from "./pull-request-row";
import { PullRequestToolbar } from "./pull-request-toolbar";

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
        mergeable: item.mergeable ?? null,
        stack: item.stack,
    };
}

function usePullSearchQuery(args: SearchArgs, opts?: { enabled?: boolean }) {
    const live = api.pulls.search.useQuery(args, {
        ...opts,
        staleTime: 0,
        refetchOnMount: "always",
        placeholderData: () => undefined,
    });
    const cached = api.pulls.searchCached.useQuery(args, {
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
    const utils = api.useUtils();
    const searchFetch = useCallback(
        (args: SearchArgs) => utils.pulls.search.fetch(args),
        [utils],
    );

    const list = useSearchList<PrSearchItem>(
        {
            provider: config.provider,
            baseRoute: `${config.basePath}/${owner}/${repo}/pulls`,
            owner,
            repo,
            defaultState,
            autocompleteOptions: config.autocompleteOptions,
            stateQualifierFn: (tab) =>
                tab === "merged" ? "is:merged" : `is:${tab}`,
            qualifiers: config.qualifiers,
        },
        {
            useSearchQuery: usePullSearchQuery,
            searchFetch,
        },
    );

    // Enrichment pass unique to pull requests: status checks and mergeability
    // come from a second query keyed by PR number.
    const prNumbers = useMemo(
        () => list.data?.items.map((i) => i.number) ?? [],
        [list.data],
    );

    const { data: detailsByPr } = api.pulls.listDetailsByPrNumbers.useQuery(
        { owner, repo, prNumbers },
        { enabled: config.fetchStatusChecks && prNumbers.length > 0 },
    );

    const items = useMemo(() => {
        return (list.data?.items ?? []).map((item) => {
            const normalized = normalizeSearchItem(item);
            if (config.fetchStatusChecks) {
                const details = detailsByPr?.[item.number];
                if (details) {
                    normalized.status_contexts = details.statusContexts;
                    normalized.status_state = computeStatusState(
                        details.statusContexts,
                    );
                    normalized.mergeable = details.mergeStateStatus;
                }
            }
            return normalized;
        });
    }, [list.data, detailsByPr, config.fetchStatusChecks]);

    const filters = rowQualifierFilters(list);

    return (
        <>
            <RecentlyPushedBanner
                owner={owner}
                repo={repo}
                provider={config.provider}
            />
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
                        placeholder="Search pull requests by title, body, or comments"
                        urls={pullRequestExternalUrls(
                            config.provider,
                            owner,
                            repo,
                        )}
                        newItemIcon={<GitPullRequest className="size-4" />}
                        newItemLabel="New Pull Request"
                        onSearch={list.handleSearch}
                        onClear={list.handleClearSearch}
                        onAutocompleteSelect={list.handleAutocompleteSelect}
                    />
                }
                toolbar={
                    <PullRequestToolbar
                        activeTab={list.activeTab as FilterState}
                        searchQuery={list.searchQuery}
                        setSearchInput={list.setSearchInput}
                        currentSort={list.currentSort}
                        currentOrder={list.currentOrder}
                        config={config}
                        owner={owner}
                        repo={repo}
                        stateCounts={
                            list.stateCounts as
                                | {
                                      open: number;
                                      closed: number;
                                      merged: number;
                                  }
                                | undefined
                        }
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
                    <PullRequestEmptyState
                        searchQuery={list.searchQuery}
                        activeTab={list.activeTab}
                    />
                }
                rows={
                    <div>
                        {items.map((pr) => (
                            <PullRequestRow
                                key={pr.id}
                                provider={config.provider}
                                pr={pr}
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
        </>
    );
}
