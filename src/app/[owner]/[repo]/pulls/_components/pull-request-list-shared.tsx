"use client";

import { GitPullRequest } from "lucide-react";
import { useMemo } from "react";
import { ListSearchBar } from "~/app/[owner]/[repo]/_components/list/list-search-bar";
import { ListSkeleton } from "~/app/[owner]/[repo]/_components/list/list-skeleton";
import { rowQualifierFilters } from "~/app/[owner]/[repo]/_components/list/row-qualifier-filters";
import { SearchListLayout } from "~/app/[owner]/[repo]/_components/list/search-list-layout";
import { useSearchList } from "~/app/[owner]/[repo]/_components/use-search-list";
import type { PrRowData } from "~/app/gh/[owner]/[repo]/pulls/_components/pull-request-row";
import { PullRequestRow } from "~/app/gh/[owner]/[repo]/pulls/_components/pull-request-row";
import { computeStatusState } from "~/components/ci-status";
import type { PrSearchItem } from "~/server/api/routers/pulls/types";
import { api } from "~/trpc/react";
import { PullRequestEmptyState } from "./pull-request-empty-state";
import type {
    FilterState,
    PullRequestListConfig,
} from "./pull-request-list-config";
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
            useSearchQuery: api.pulls.search.useQuery,
            searchFetch: (args) => utils.pulls.search.fetch(args),
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
                    urls={config.externalUrls(owner, repo)}
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
                            | { open: number; closed: number; merged: number }
                            | undefined
                    }
                    onTabChange={list.setTab}
                    onNavigate={list.navigate}
                    onAddQualifier={list.handleAddQualifier}
                    onRemoveQualifier={list.handleRemoveQualifier}
                />
            }
            showLoading={list.showLoading}
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
    );
}
