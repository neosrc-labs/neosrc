export type FilterState = "open" | "closed";

export const ISSUE_QUALIFIERS = ["author", "label", "assignee", "sort", "is"];

export const ISSUE_AUTOCOMPLETE_OPTIONS: Record<
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
        { label: "open", subtitle: "Open issues" },
        { label: "closed", subtitle: "Closed issues" },
    ],
};

export function buildIssueConfig(
    provider: "gh" | "cb",
    owner: string,
    repo: string,
) {
    return {
        provider,
        baseRoute: `/${provider}/${owner}/${repo}/issues`,
        qualifiers: ISSUE_QUALIFIERS,
        autocompleteOptions: ISSUE_AUTOCOMPLETE_OPTIONS,
        stateQualifierFn: (tab: string) => `is:${tab}`,
    };
}
