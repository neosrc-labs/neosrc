"use client";

import { ChevronDown, CircleCheck, Eye } from "lucide-react";
import { SearchListToolbar } from "~/components/list/search-list-toolbar";
import {
    hasQualifier,
    toggleQualifier,
} from "~/components/search/search-utils";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";
import type {
    FilterState,
    PullRequestListConfig,
} from "./pull-request-list-config";

export function PullRequestToolbar({
    activeTab,
    searchQuery,
    setSearchInput,
    currentSort,
    currentOrder,
    config,
    owner,
    repo,
    stateCounts,
    onTabChange,
    onNavigate,
    onAddQualifier,
    onRemoveQualifier,
}: {
    activeTab: FilterState;
    searchQuery: string;
    setSearchInput: (value: string) => void;
    currentSort: string;
    currentOrder: string;
    config: PullRequestListConfig;
    owner: string;
    repo: string;
    stateCounts?: { open: number; closed: number; merged: number };
    onTabChange: (tab: FilterState) => void;
    onNavigate: (changes: Record<string, string | null>) => void;
    onAddQualifier: (key: string, value: string) => void;
    onRemoveQualifier: (key: string, value: string) => void;
}) {
    const toggleAndNavigate = (key: string, value: string) => {
        const newQuery = toggleQualifier(searchQuery, key, value);
        setSearchInput(newQuery);
        onNavigate({ q: newQuery || null, page: null });
    };

    return (
        <SearchListToolbar
            tabs={config.tabs}
            activeTab={activeTab}
            searchQuery={searchQuery}
            setSearchInput={setSearchInput}
            currentSort={currentSort}
            currentOrder={currentOrder}
            provider={config.provider}
            owner={owner}
            repo={repo}
            stateCounts={stateCounts}
            showAssigneeFilter={config.showAssigneeFilter}
            onTabChange={(tab) => onTabChange(tab as FilterState)}
            onNavigate={onNavigate}
            onAddQualifier={onAddQualifier}
            onRemoveQualifier={onRemoveQualifier}
        >
            {config.showStatusFilter && (
                <StatusFilterDropdown
                    currentQuery={searchQuery}
                    onToggle={toggleAndNavigate}
                />
            )}
            {config.showReviewFilter && (
                <ReviewFilterDropdown
                    currentQuery={searchQuery}
                    onToggle={toggleAndNavigate}
                />
            )}
        </SearchListToolbar>
    );
}

function StatusFilterDropdown({
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
                o: {
                    label: string;
                    subtitle: string;
                },
                selected: boolean,
            ) => (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate">{o.label}</span>
                    {selected && (
                        <span className="ml-auto shrink-0 text-link text-xs">
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
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2.5 py-1.5 font-medium text-sm text-text-label transition-colors hover:bg-surface-tertiary"
                >
                    <CircleCheck className="size-4" />
                    Checks
                    <ChevronDown className="size-3.5 text-text-muted" />
                </button>
            }
        />
    );
}

function ReviewFilterDropdown({
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
                o: {
                    label: string;
                    subtitle: string;
                },
                selected: boolean,
            ) => (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate">{o.subtitle ?? o.label}</span>
                    {selected && (
                        <span className="ml-auto shrink-0 text-link text-xs">
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
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2.5 py-1.5 font-medium text-sm text-text-label transition-colors hover:bg-surface-tertiary"
                >
                    <Eye className="size-4" />
                    Review
                    <ChevronDown className="size-3.5 text-text-muted" />
                </button>
            }
        />
    );
}
