"use client";

import { useMemo } from "react";
import { toggleQualifier } from "~/app/[owner]/[repo]/_components/search/search-utils";
import { useSearchList } from "~/app/[owner]/[repo]/_components/use-search-list";
import type { PrRowData } from "~/app/gh/[owner]/[repo]/pulls/_components/pull-request-row";
import { PullRequestRow } from "~/app/gh/[owner]/[repo]/pulls/_components/pull-request-row";
import { computeStatusState } from "~/components/ci-status";
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
            qualifiers: config.qualifiers,
            autocompleteOptions: config.autocompleteOptions,
            stateQualifierFn: (tab: string) =>
                tab === "merged" ? "is:merged" : `is:${tab}`,
        },
        {
            useSearchQuery: api.pulls.search.useQuery,
            searchFetch: (args) => utils.pulls.search.fetch(args),
        },
    );

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

    return (
        <div>
            <PullRequestSearchBar
                searchInput={list.searchInput}
                setSearchInput={list.setSearchInput}
                cursorPos={list.cursorPos}
                setCursorPos={list.setCursorPos}
                inputRef={list.inputRef}
                searchBarRef={list.searchBarRef}
                autocompleteRef={list.autocompleteRef}
                config={config}
                owner={owner}
                repo={repo}
                onSearch={list.handleSearch}
                onClear={list.handleClearSearch}
                onAutocompleteSelect={list.handleAutocompleteSelect}
            />

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

            <div className="flex items-center gap-3 border-border-subtle border-b px-4 py-1.5 text-text-muted text-xs">
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
                {list.showLoading ? (
                    <PullRequestSkeleton />
                ) : items.length === 0 ? (
                    <PullRequestEmptyState
                        searchQuery={list.searchQuery}
                        activeTab={list.activeTab}
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
                                    const newQuery = toggleQualifier(
                                        list.searchQuery,
                                        "label",
                                        name,
                                        "add",
                                    );
                                    list.setSearchInput(newQuery);
                                    list.navigate({
                                        q: newQuery || null,
                                        page: null,
                                    });
                                }}
                                onAuthorFilter={(login) => {
                                    const newQuery = toggleQualifier(
                                        list.searchQuery,
                                        "author",
                                        login,
                                    );
                                    list.setSearchInput(newQuery);
                                    list.navigate({
                                        q: newQuery || null,
                                        page: null,
                                    });
                                }}
                                onAssigneesFilter={(login) => {
                                    const newQuery = toggleQualifier(
                                        list.searchQuery,
                                        "assignee",
                                        login,
                                    );
                                    list.setSearchInput(newQuery);
                                    list.navigate({
                                        q: newQuery || null,
                                        page: null,
                                    });
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {!list.showLoading && items.length > 0 && (
                <Pagination
                    currentPage={list.currentPage}
                    totalPages={list.totalPages}
                    onPageChange={(page) =>
                        list.navigate({ page: String(page) })
                    }
                />
            )}
        </div>
    );
}
