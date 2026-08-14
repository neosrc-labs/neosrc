import type { LucideIcon } from "lucide-react";
import { Circle, CircleCheck, Plus } from "lucide-react";
import {
    type SearchListConfig,
    SORT_AUTOCOMPLETE_OPTIONS,
} from "~/app/[owner]/[repo]/_components/search-result-list";

export const ISSUE_QUALIFIERS = ["author", "label", "assignee", "sort", "is"];

export const ISSUE_AUTOCOMPLETE_OPTIONS: Record<
    string,
    { label: string; subtitle?: string }[]
> = {
    sort: SORT_AUTOCOMPLETE_OPTIONS,
    is: [
        { label: "open", subtitle: "Open issues" },
        { label: "closed", subtitle: "Closed issues" },
    ],
};

export const ISSUE_TABS: { key: string; label: string; icon: LucideIcon }[] = [
    { key: "open", label: "Open", icon: CircleCheck },
    { key: "closed", label: "Closed", icon: Circle },
];

function buildIssueConfig(provider: "gh" | "cb"): SearchListConfig {
    const host = provider === "cb" ? "codeberg.org" : "github.com";
    return {
        provider,
        basePath: `/${provider}`,
        qualifiers: ISSUE_QUALIFIERS,
        autocompleteOptions: ISSUE_AUTOCOMPLETE_OPTIONS,
        stateQualifierFn: (tab: string) => `is:${tab}`,
        tabs: ISSUE_TABS,
        itemName: "issues",
        placeholder: "Search issues by title, body, or comments",
        newItemIcon: Plus,
        newItemLabel: "New Issue",
        externalUrls: (owner: string, repo: string) => ({
            labels: `https://${host}/${owner}/${repo}/labels`,
            milestones: `https://${host}/${owner}/${repo}/milestones`,
            new: `https://${host}/${owner}/${repo}/issues/new`,
        }),
        showAssigneeFilter: true,
    };
}

export const ghIssueConfig = buildIssueConfig("gh");
export const cbIssueConfig = buildIssueConfig("cb");
