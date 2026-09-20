"use client";

import type { ReactNode } from "react";
import { AssigneeDropdown } from "~/components/search/assignee-dropdown";
import { AuthorDropdown } from "~/components/search/author-dropdown";
import { LabelDropdown } from "~/components/search/label-dropdown";
import { MilestoneDropdown } from "~/components/search/milestone-dropdown";
import {
    hasQualifier,
    toggleQualifier,
} from "~/components/search/search-utils";
import { SortDropdown } from "~/components/search/sort-dropdown";
import type { Provider } from "~/utils/provider-url";
import { StateTabs } from "./state-tabs";

export interface SearchListToolbarProps {
    tabs: readonly { key: string; label: string }[];
    activeTab: string;
    searchQuery: string;
    setSearchInput: (value: string) => void;
    currentSort: string;
    currentOrder: string;
    provider: Provider;
    owner: string;
    repo: string;
    stateCounts?: Record<string, number>;
    showAssigneeFilter: boolean;
    onTabChange: (tab: string) => void;
    onNavigate: (changes: Record<string, string | null>) => void;
    onAddQualifier: (key: string, value: string) => void;
    onRemoveQualifier: (key: string, value: string) => void;
    children?: ReactNode;
}

export function SearchListToolbar({
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
    showAssigneeFilter,
    onTabChange,
    onNavigate,
    onAddQualifier,
    onRemoveQualifier,
    children,
}: SearchListToolbarProps) {
    const toggleAndNavigate = (key: string, value: string) => {
        const newQuery = toggleQualifier(searchQuery, key, value);
        setSearchInput(newQuery);
        onNavigate({ q: newQuery || null, page: null });
    };
    const toggleMultiValue = (key: string, value: string) => {
        if (hasQualifier(searchQuery, key, value)) {
            onRemoveQualifier(key, value);
        } else {
            onAddQualifier(key, value);
        }
    };

    return (
        <div className="border-border-subtle border-b">
            <div className="flex items-center justify-between px-4">
                <StateTabs
                    tabs={tabs}
                    activeTab={activeTab}
                    stateCounts={stateCounts}
                    onTabChange={onTabChange}
                />
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
                        onToggle={(value) => toggleMultiValue("label", value)}
                    />
                    <MilestoneDropdown
                        provider={provider}
                        owner={owner}
                        repo={repo}
                        currentQuery={searchQuery}
                        onToggle={(value) =>
                            toggleMultiValue("milestone", value)
                        }
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
