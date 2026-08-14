"use client";

import type { LucideIcon } from "lucide-react";
import {
    toggleLabelQualifier,
    toggleValueQualifier,
} from "~/app/[owner]/[repo]/_components/search/search-utils";
import type { SearchListResult } from "~/app/[owner]/[repo]/_components/use-search-list";
import { Pagination } from "~/components/ui/pagination";
import { ListEmptyState } from "./list-empty-state";
import { ListSearchBar } from "./list-search-bar";
import { ListSkeleton } from "./list-skeleton";
import { ListToolbar } from "./list-toolbar";

export interface SearchListConfig {
    provider: "gh" | "cb";
    basePath: string;
    qualifiers: string[];
    autocompleteOptions: Record<string, { label: string; subtitle?: string }[]>;
    stateQualifierFn: (tab: string) => string;
    tabs: { key: string; label: string; icon: LucideIcon }[];
    itemName: string;
    placeholder: string;
    newItemIcon: LucideIcon;
    newItemLabel: string;
    externalUrls: (
        owner: string,
        repo: string,
    ) => { labels: string; milestones: string; new: string };
    showAssigneeFilter?: boolean;
}

export const SORT_AUTOCOMPLETE_OPTIONS: {
    label: string;
    subtitle?: string;
}[] = [
    { label: "created-desc", subtitle: "Newest" },
    { label: "created-asc", subtitle: "Oldest" },
    { label: "updated-desc", subtitle: "Recently updated" },
    { label: "comments-desc", subtitle: "Most commented" },
];

export interface SearchListFilterHandlers {
    onLabelFilter: (name: string) => void;
    onAuthorFilter: (login: string) => void;
    onAssigneesFilter: (login: string) => void;
}

export function SearchResultListShell<TList, TItem>({
    config,
    owner,
    repo,
    list,
    items,
    toolbarChildren,
    renderRow,
}: {
    config: SearchListConfig;
    owner: string;
    repo: string;
    list: SearchListResult<TList>;
    items: TItem[];
    toolbarChildren?: React.ReactNode;
    renderRow: (
        item: TItem,
        handlers: SearchListFilterHandlers,
    ) => React.ReactNode;
}) {
    const applyFilter = (newQuery: string) => {
        list.setSearchInput(newQuery);
        list.navigate({ q: newQuery || null, page: null });
    };

    const filterHandlers: SearchListFilterHandlers = {
        onLabelFilter: (name) =>
            applyFilter(toggleLabelQualifier(list.searchQuery, name)),
        onAuthorFilter: (login) =>
            applyFilter(
                toggleValueQualifier(list.searchQuery, "author", login),
            ),
        onAssigneesFilter: (login) =>
            applyFilter(
                toggleValueQualifier(list.searchQuery, "assignee", login),
            ),
    };

    const urls = config.externalUrls(owner, repo);

    return (
        <div>
            <ListSearchBar
                searchInput={list.searchInput}
                setSearchInput={list.setSearchInput}
                cursorPos={list.cursorPos}
                setCursorPos={list.setCursorPos}
                inputRef={list.inputRef}
                searchBarRef={list.searchBarRef}
                autocompleteRef={list.autocompleteRef}
                placeholder={config.placeholder}
                provider={config.provider}
                owner={owner}
                repo={repo}
                qualifiers={config.qualifiers}
                autocompleteOptions={config.autocompleteOptions}
                labelsHref={urls.labels}
                milestonesHref={urls.milestones}
                newItemHref={urls.new}
                newItemIcon={config.newItemIcon}
                newItemLabel={config.newItemLabel}
                onSearch={list.handleSearch}
                onClear={list.handleClearSearch}
                onAutocompleteSelect={list.handleAutocompleteSelect}
            />

            <ListToolbar
                tabs={config.tabs}
                activeTab={list.activeTab}
                searchQuery={list.searchQuery}
                setSearchInput={list.setSearchInput}
                currentSort={list.currentSort}
                currentOrder={list.currentOrder}
                provider={config.provider}
                owner={owner}
                repo={repo}
                stateCounts={list.stateCounts}
                showAssigneeFilter={config.showAssigneeFilter}
                onTabChange={list.setTab}
                onNavigate={list.navigate}
                onAddQualifier={list.handleAddQualifier}
                onRemoveQualifier={list.handleRemoveQualifier}
            >
                {toolbarChildren}
            </ListToolbar>

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
                    <ListSkeleton />
                ) : items.length === 0 ? (
                    <ListEmptyState
                        searchQuery={list.searchQuery}
                        activeTab={list.activeTab}
                        itemName={config.itemName}
                        tabs={config.tabs}
                    />
                ) : (
                    <div>
                        {items.map((item) => renderRow(item, filterHandlers))}
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
