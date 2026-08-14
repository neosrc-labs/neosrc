"use client";

import type { LucideIcon } from "lucide-react";
import { AssigneeDropdown } from "~/app/[owner]/[repo]/_components/search/assignee-dropdown";
import { AuthorDropdown } from "~/app/[owner]/[repo]/_components/search/author-dropdown";
import { LabelDropdown } from "~/app/[owner]/[repo]/_components/search/label-dropdown";
import { MilestoneDropdown } from "~/app/[owner]/[repo]/_components/search/milestone-dropdown";
import {
    hasQualifier,
    toggleValueQualifier,
} from "~/app/[owner]/[repo]/_components/search/search-utils";
import { SortDropdown } from "~/app/[owner]/[repo]/_components/search/sort-dropdown";

export function ListToolbar({
    tabs,
    activeTab,
    searchQuery,
    setSearchInput,
    currentSort,
    currentOrder,
    provider,
    owner,
    repo,
    stateCounts,
    showAssigneeFilter = true,
    children,
    onTabChange,
    onNavigate,
    onAddQualifier,
    onRemoveQualifier,
}: {
    tabs: { key: string; label: string; icon: LucideIcon }[];
    activeTab: string;
    searchQuery: string;
    setSearchInput: (value: string) => void;
    currentSort: string;
    currentOrder: string;
    provider: "gh" | "cb";
    owner: string;
    repo: string;
    stateCounts?: Record<string, number>;
    showAssigneeFilter?: boolean;
    children?: React.ReactNode;
    onTabChange: (tab: string) => void;
    onNavigate: (changes: Record<string, string | null>) => void;
    onAddQualifier: (key: string, value: string) => void;
    onRemoveQualifier: (key: string, value: string) => void;
}) {
    const toggleAndNavigate = (key: string, value: string) => {
        const newQuery = toggleValueQualifier(searchQuery, key, value);
        setSearchInput(newQuery);
        onNavigate({
            q: newQuery || null,
            page: null,
        });
    };

    return (
        <div className="border-border-subtle border-b">
            <div className="flex items-center justify-between px-4">
                <div className="flex items-center">
                    {tabs.map((tab) => {
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
                                        className="ml-1.5 rounded-full bg-surface-selected px-1.5 py-0.5 text-xs tabular-nums"
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
                        provider={provider}
                        owner={owner}
                        repo={repo}
                        currentQuery={searchQuery}
                        onToggle={toggleAndNavigate}
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

                    {showAssigneeFilter && (
                        <AssigneeDropdown
                            provider={provider}
                            owner={owner}
                            repo={repo}
                            currentQuery={searchQuery}
                            onToggle={toggleAndNavigate}
                        />
                    )}

                    {children}

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
