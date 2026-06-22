export type FilterState = "open" | "closed" | "merged";

export interface PullRequestListConfig {
    provider: "gh" | "cb";
    basePath: string;
    qualifiers: string[];
    autocompleteOptions: Record<string, { label: string; subtitle?: string }[]>;
    showAssigneeFilter: boolean;
    showStatusFilter: boolean;
    showReviewFilter: boolean;
    fetchStatusChecks: boolean;
    externalUrls: (
        owner: string,
        repo: string,
    ) => {
        labels: string;
        milestones: string;
        newPr: string;
    };
}

export const TABS: { key: FilterState; label: string }[] = [
    { key: "open", label: "Open" },
    { key: "closed", label: "Closed" },
    { key: "merged", label: "Merged" },
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
    sort: [
        { label: "created-desc", subtitle: "Newest" },
        { label: "created-asc", subtitle: "Oldest" },
        { label: "updated-desc", subtitle: "Recently updated" },
        { label: "comments-desc", subtitle: "Most commented" },
    ],
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
    sort: [
        { label: "created-desc", subtitle: "Newest" },
        { label: "created-asc", subtitle: "Oldest" },
        { label: "updated-desc", subtitle: "Recently updated" },
        { label: "comments-desc", subtitle: "Most commented" },
    ],
    is: [
        { label: "open", subtitle: "Open pull requests" },
        { label: "closed", subtitle: "Closed pull requests" },
        { label: "merged", subtitle: "Merged pull requests" },
    ],
};

export const ghConfig: PullRequestListConfig = {
    provider: "gh",
    basePath: "/gh",
    qualifiers: [...PR_QUALIFIERS],
    autocompleteOptions: GH_AUTOCOMPLETE_OPTIONS,
    showAssigneeFilter: true,
    showStatusFilter: true,
    showReviewFilter: true,
    fetchStatusChecks: true,
    externalUrls: (owner: string, repo: string) => ({
        labels: `https://github.com/${owner}/${repo}/labels`,
        milestones: `https://github.com/${owner}/${repo}/milestones`,
        newPr: `https://github.com/${owner}/${repo}/compare`,
    }),
};

export const cbConfig: PullRequestListConfig = {
    provider: "cb",
    basePath: "/cb",
    qualifiers: ["author", "label", "assignee", "sort", "is"],
    autocompleteOptions: CB_AUTOCOMPLETE_OPTIONS,
    showAssigneeFilter: false,
    showStatusFilter: false,
    showReviewFilter: false,
    fetchStatusChecks: false,
    externalUrls: (owner: string, repo: string) => ({
        labels: `https://codeberg.org/${owner}/${repo}/labels`,
        milestones: `https://codeberg.org/${owner}/${repo}/milestones`,
        newPr: `https://codeberg.org/${owner}/${repo}/compare`,
    }),
};
