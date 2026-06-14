"use client";

import { useMemo } from "react";
import {
    addQualifier,
    hasQualifier,
    removeQualifier,
    replaceQualifier,
} from "~/app/[owner]/[repo]/_components/search/search-utils";
import { useSearchList } from "~/app/[owner]/[repo]/_components/use-search-list";
import { Pagination } from "~/components/ui/pagination";
import type { IssueSearchItem } from "~/server/api/routers/issues/types";
import { api } from "~/trpc/react";
import { IssueEmptyState } from "./issue-empty-state";
import {
    buildIssueConfig,
    ISSUE_AUTOCOMPLETE_OPTIONS,
    ISSUE_QUALIFIERS,
} from "./issue-list-config";
import type { IssueRowData } from "./issue-row";
import { IssueRow } from "./issue-row";
import { IssueSearchBar } from "./issue-search-bar";
import { IssueSkeleton } from "./issue-skeleton";
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
    const config = buildIssueConfig(provider, owner, repo);

    const list = useSearchList(
        {
            ...config,
            owner,
            repo,
            defaultState,
        },
        {
            useSearchQuery: api.issues.search.useQuery,
            searchFetch: (args) => utils.issues.search.fetch(args),
        },
    );

    const items = useMemo(
        () =>
            ((list.data?.items ?? []) as IssueSearchItem[]).map(
                normalizeSearchItem,
            ),
        [list.data],
    );

    return (
        <div>
            <IssueSearchBar
                searchInput={list.searchInput}
                setSearchInput={list.setSearchInput}
                cursorPos={list.cursorPos}
                setCursorPos={list.setCursorPos}
                inputRef={list.inputRef}
                searchBarRef={list.searchBarRef}
                autocompleteRef={list.autocompleteRef}
                qualifiers={ISSUE_QUALIFIERS}
                autocompleteOptions={ISSUE_AUTOCOMPLETE_OPTIONS}
                provider={provider}
                owner={owner}
                repo={repo}
                onSearch={list.handleSearch}
                onClear={list.handleClearSearch}
                onAutocompleteSelect={list.handleAutocompleteSelect}
            />

            <IssueToolbar
                activeTab={list.activeTab}
                searchQuery={list.searchQuery}
                setSearchInput={list.setSearchInput}
                currentSort={list.currentSort}
                currentOrder={list.currentOrder}
                provider={provider}
                owner={owner}
                repo={repo}
                stateCounts={list.stateCounts}
                onTabChange={list.setTab}
                onNavigate={list.navigate}
                onAddQualifier={list.handleAddQualifier}
                onRemoveQualifier={list.handleRemoveQualifier}
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
                {list.showLoading ? (
                    <IssueSkeleton />
                ) : items.length === 0 ? (
                    <IssueEmptyState
                        searchQuery={list.searchQuery}
                        activeTab={list.activeTab}
                    />
                ) : (
                    <div>
                        {items.map((issue) => (
                            <IssueRow
                                key={issue.number}
                                issue={issue}
                                provider={provider}
                                owner={owner}
                                repo={repo}
                                onLabelFilter={(name) => {
                                    const newQuery = hasQualifier(
                                        list.searchQuery,
                                        "label",
                                        name,
                                    )
                                        ? removeQualifier(
                                              list.searchQuery,
                                              "label",
                                              name,
                                          )
                                        : addQualifier(
                                              list.searchQuery,
                                              "label",
                                              name,
                                          );
                                    list.setSearchInput(newQuery);
                                    list.navigate({
                                        q: newQuery || null,
                                        page: null,
                                    });
                                }}
                                onAuthorFilter={(login) => {
                                    const newQuery = hasQualifier(
                                        list.searchQuery,
                                        "author",
                                        login,
                                    )
                                        ? removeQualifier(
                                              list.searchQuery,
                                              "author",
                                              login,
                                          )
                                        : replaceQualifier(
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
                                    const newQuery = hasQualifier(
                                        list.searchQuery,
                                        "assignee",
                                        login,
                                    )
                                        ? removeQualifier(
                                              list.searchQuery,
                                              "assignee",
                                              login,
                                          )
                                        : replaceQualifier(
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
