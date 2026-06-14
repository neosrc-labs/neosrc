import type { SearchArgs } from "~/app/[owner]/[repo]/_components/use-search-list";

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

export function getIssueExternalUrls(
    provider: "gh" | "cb",
    owner: string,
    repo: string,
) {
    const host = provider === "cb" ? "codeberg.org" : "github.com";
    return {
        labels: `https://${host}/${owner}/${repo}/labels`,
        milestones: `https://${host}/${owner}/${repo}/milestones`,
        newIssue: `https://${host}/${owner}/${repo}/issues/new`,
    };
}

export function issueSearchArgs(
    provider: "gh" | "cb",
    owner: string,
    repo: string,
    apiQuery: string,
    page: number,
    after?: string,
    sort?: string,
    order?: string,
): SearchArgs {
    return {
        provider,
        owner,
        repo,
        query: apiQuery,
        page,
        after,
        first: 30,
        sort: sort as "created" | "updated" | "comments",
        order: order as "asc" | "desc",
    };
}
