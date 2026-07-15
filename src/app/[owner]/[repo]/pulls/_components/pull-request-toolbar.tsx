"use client";

import { ChevronDown, CircleCheck, Eye } from "lucide-react";
import { AssigneeDropdown } from "~/app/[owner]/[repo]/_components/search/assignee-dropdown";
import { AuthorDropdown } from "~/app/[owner]/[repo]/_components/search/author-dropdown";
import { LabelDropdown } from "~/app/[owner]/[repo]/_components/search/label-dropdown";
import { MilestoneDropdown } from "~/app/[owner]/[repo]/_components/search/milestone-dropdown";
import {
    hasQualifier,
    removeQualifier,
    replaceQualifier,
} from "~/app/[owner]/[repo]/_components/search/search-utils";
import { SortDropdown } from "~/app/[owner]/[repo]/_components/search/sort-dropdown";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";
import type {
    FilterState,
    PullRequestListConfig,
} from "./pull-request-list-config";
import { TABS } from "./pull-request-list-config";

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
    return (
        <div className="border-gray-200 border-b dark:border-zinc-800">
            <div className="flex items-center justify-between px-4">
                <div className="flex items-center">
                    {TABS.map((tab) => {
                        const count = stateCounts?.[tab.key];
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => onTabChange(tab.key)}
                                aria-label={
                                    count !== undefined
                                        ? `${tab.label} (${count.toLocaleString()})`
                                        : tab.label
                                }
                                className={`relative -mb-px cursor-pointer px-4 py-3 font-medium text-sm transition-colors ${
                                    activeTab === tab.key
                                        ? "border-blue-500 border-b-2 text-text-primary"
                                        : "text-text-secondary hover:text-text-primary dark:hover:text-zinc-100"
                                }`}
                            >
                                {tab.label}
                                {count !== undefined && (
                                    <span
                                        aria-hidden="true"
                                        className="ml-1.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs tabular-nums dark:bg-zinc-700"
                                    >
                                        {count.toLocaleString()}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="flex items-center gap-2">
                    <AuthorDropdown
                        provider={config.provider}
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
                            onNavigate({
                                q: newQuery || null,
                                page: null,
                            });
                        }}
                    />

                    <LabelDropdown
                        provider={config.provider}
                        owner={owner}
                        repo={repo}
                        currentQuery={searchQuery}
                        onToggle={(labelName: string) => {
                            if (hasQualifier(searchQuery, "label", labelName)) {
                                onRemoveQualifier("label", labelName);
                            } else {
                                onAddQualifier("label", labelName);
                            }
                        }}
                    />

                    <MilestoneDropdown
                        provider={config.provider}
                        owner={owner}
                        repo={repo}
                        currentQuery={searchQuery}
                        onToggle={(milestone: string) => {
                            const quoted = `"${milestone}"`;
                            if (
                                hasQualifier(searchQuery, "milestone", quoted)
                            ) {
                                onRemoveQualifier("milestone", quoted);
                            } else {
                                onAddQualifier("milestone", quoted);
                            }
                        }}
                    />

                    {config.showAssigneeFilter && (
                        <AssigneeDropdown
                            provider={config.provider}
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
                                onNavigate({
                                    q: newQuery || null,
                                    page: null,
                                });
                            }}
                        />
                    )}

                    {config.showStatusFilter && (
                        <StatusFilterDropdown
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
                                onNavigate({
                                    q: newQuery || null,
                                    page: null,
                                });
                            }}
                        />
                    )}

                    {config.showReviewFilter && (
                        <ReviewFilterDropdown
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
                                onNavigate({
                                    q: newQuery || null,
                                    page: null,
                                });
                            }}
                        />
                    )}

                    <SortDropdown
                        currentSort={
                            currentSort as "created" | "updated" | "comments"
                        }
                        currentOrder={currentOrder as "asc" | "desc"}
                        onSelect={(sort, order) =>
                            onNavigate({ sort, order, page: null })
                        }
                    />
                </div>
            </div>
        </div>
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
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-sm text-text-label transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
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
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-sm text-text-label transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                    <Eye className="size-4" />
                    Review
                    <ChevronDown className="size-3.5 text-text-muted" />
                </button>
            }
        />
    );
}
