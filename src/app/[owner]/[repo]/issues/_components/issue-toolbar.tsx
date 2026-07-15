"use client";

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

const TABS = [
    { key: "open", label: "Open" },
    { key: "closed", label: "Closed" },
];

export function IssueToolbar({
    activeTab,
    searchQuery,
    setSearchInput,
    currentSort,
    currentOrder,
    provider,
    owner,
    repo,
    stateCounts,
    onTabChange,
    onNavigate,
    onAddQualifier,
    onRemoveQualifier,
}: {
    activeTab: string;
    searchQuery: string;
    setSearchInput: (value: string) => void;
    currentSort: string;
    currentOrder: string;
    provider: "gh" | "cb";
    owner: string;
    repo: string;
    stateCounts?: Record<string, number>;
    onTabChange: (tab: string) => void;
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
                                className={`relative -mb-px cursor-pointer px-4 py-3 font-medium text-sm transition-colors ${
                                    activeTab === tab.key
                                        ? "border-blue-500 border-b-2 text-gray-900 dark:text-zinc-100"
                                        : "text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-gray-100"
                                }`}
                            >
                                {tab.label}
                                {count !== undefined && (
                                    <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs tabular-nums dark:bg-zinc-700">
                                        {count.toLocaleString()}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="flex items-center gap-2">
                    <AuthorDropdown
                        provider={provider}
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
                        provider={provider}
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
                        provider={provider}
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

                    <AssigneeDropdown
                        provider={provider}
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
