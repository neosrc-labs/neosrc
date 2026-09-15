"use client";

import { StateTabs } from "~/components/list/state-tabs";
import { AssigneeDropdown } from "~/components/search/assignee-dropdown";
import { AuthorDropdown } from "~/components/search/author-dropdown";
import { LabelDropdown } from "~/components/search/label-dropdown";
import { MilestoneDropdown } from "~/components/search/milestone-dropdown";
import {
    hasQualifier,
    toggleQualifier,
} from "~/components/search/search-utils";
import { SortDropdown } from "~/components/search/sort-dropdown";

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
        <div className="border-border-subtle border-b">
            <div className="flex items-center justify-between px-4">
                <StateTabs
                    tabs={TABS}
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
                        onToggle={(key: string, value: string) => {
                            const newQuery = toggleQualifier(
                                searchQuery,
                                key,
                                value,
                            );
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
                            if (
                                hasQualifier(
                                    searchQuery,
                                    "milestone",
                                    milestone,
                                )
                            ) {
                                onRemoveQualifier("milestone", milestone);
                            } else {
                                onAddQualifier("milestone", milestone);
                            }
                        }}
                    />

                    <AssigneeDropdown
                        provider={provider}
                        owner={owner}
                        repo={repo}
                        currentQuery={searchQuery}
                        onToggle={(key: string, value: string) => {
                            const newQuery = toggleQualifier(
                                searchQuery,
                                key,
                                value,
                            );
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
