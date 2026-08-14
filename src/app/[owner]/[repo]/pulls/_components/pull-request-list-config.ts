import type { LucideIcon } from "lucide-react";
import { GitMerge, GitPullRequest, GitPullRequestClosed } from "lucide-react";
import {
    type SearchListConfig,
    SORT_AUTOCOMPLETE_OPTIONS,
} from "~/app/[owner]/[repo]/_components/search-result-list";

export type FilterState = "open" | "closed" | "merged";

export interface PullRequestListConfig extends SearchListConfig {
    showStatusFilter: boolean;
    showReviewFilter: boolean;
    fetchStatusChecks: boolean;
}

export const TABS: { key: FilterState; label: string; icon: LucideIcon }[] = [
    { key: "open", label: "Open", icon: GitPullRequest },
    { key: "closed", label: "Closed", icon: GitPullRequestClosed },
    { key: "merged", label: "Merged", icon: GitMerge },
];

const PR_QUALIFIERS = [
    "author",
    "label",
    "assignee",
    "sort",
    "review",
    "status",
    "is",
];

const GH_AUTOCOMPLETE_OPTIONS: Record<
    string,
    { label: string; subtitle?: string }[]
> = {
    sort: SORT_AUTOCOMPLETE_OPTIONS,
    review: [
        { label: "none", subtitle: "Not reviewed" },
        { label: "required", subtitle: "Review required" },
        { label: "approved", subtitle: "Approved" },
        { label: "changes_requested", subtitle: "Changes requested" },
    ],
    status: [
        { label: "pending", subtitle: "Pending" },
        { label: "success", subtitle: "Success" },
        { label: "failure", subtitle: "Failure" },
    ],
    is: [
        { label: "open", subtitle: "Open pull requests" },
        { label: "closed", subtitle: "Closed pull requests" },
        { label: "merged", subtitle: "Merged pull requests" },
    ],
};

const CB_AUTOCOMPLETE_OPTIONS: Record<
    string,
    { label: string; subtitle?: string }[]
> = {
    sort: SORT_AUTOCOMPLETE_OPTIONS,
    is: [
        { label: "open", subtitle: "Open pull requests" },
        { label: "closed", subtitle: "Closed pull requests" },
        { label: "merged", subtitle: "Merged pull requests" },
    ],
};

const SHARED_OPTIONS = {
    stateQualifierFn: (tab: string) =>
        tab === "merged" ? "is:merged" : `is:${tab}`,
    tabs: TABS,
    itemName: "pull requests",
    placeholder: "Search pull requests by title, body, or comments",
    newItemIcon: GitPullRequest,
    newItemLabel: "New Pull Request",
};

export const ghConfig: PullRequestListConfig = {
    provider: "gh",
    basePath: "/gh",
    qualifiers: [...PR_QUALIFIERS],
    autocompleteOptions: GH_AUTOCOMPLETE_OPTIONS,
    externalUrls: (owner: string, repo: string) => ({
        labels: `https://github.com/${owner}/${repo}/labels`,
        milestones: `https://github.com/${owner}/${repo}/milestones`,
        new: `https://github.com/${owner}/${repo}/compare`,
    }),
    showAssigneeFilter: true,
    showStatusFilter: true,
    showReviewFilter: true,
    fetchStatusChecks: true,
    ...SHARED_OPTIONS,
};

export const cbConfig: PullRequestListConfig = {
    provider: "cb",
    basePath: "/cb",
    qualifiers: ["author", "label", "assignee", "sort", "is"],
    autocompleteOptions: CB_AUTOCOMPLETE_OPTIONS,
    externalUrls: (owner: string, repo: string) => ({
        labels: `https://codeberg.org/${owner}/${repo}/labels`,
        milestones: `https://codeberg.org/${owner}/${repo}/milestones`,
        new: `https://codeberg.org/${owner}/${repo}/compare`,
    }),
    showAssigneeFilter: false,
    showStatusFilter: false,
    showReviewFilter: false,
    fetchStatusChecks: false,
    ...SHARED_OPTIONS,
};
