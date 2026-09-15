export const ISSUE_QUALIFIERS = [
    "author",
    "label",
    "assignee",
    "sort",
    "is",
    "has",
    "no",
];

type AutocompleteOption = { label: string; subtitle?: string };

const NO_OPTIONS: AutocompleteOption[] = [
    { label: "assignee", subtitle: "No assignee" },
    { label: "label", subtitle: "No labels" },
    { label: "milestone", subtitle: "No milestone" },
];

// GitHub's search backend ignores has: for label and milestone, so only
// assignee is offered there. Codeberg filters every field on the fetched page.
const PRESENCE_OPTIONS: Record<
    "gh" | "cb",
    Record<string, AutocompleteOption[]>
> = {
    gh: {
        has: [{ label: "assignee", subtitle: "Has an assignee" }],
        no: NO_OPTIONS,
    },
    cb: {
        has: [
            { label: "assignee", subtitle: "Has an assignee" },
            { label: "label", subtitle: "Has labels" },
            { label: "milestone", subtitle: "Has a milestone" },
        ],
        no: NO_OPTIONS,
    },
};

const AUTOCOMPLETE_OPTIONS: Record<string, AutocompleteOption[]> = {
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
    const host = provider === "cb" ? "codeberg.org" : "github.com";

    return {
        provider,
        baseRoute: `/${provider}/${owner}/${repo}/issues`,
        qualifiers: ISSUE_QUALIFIERS,
        autocompleteOptions: {
            ...AUTOCOMPLETE_OPTIONS,
            ...PRESENCE_OPTIONS[provider],
        },
        stateQualifierFn: (tab: string) => `is:${tab}`,
        externalUrls: {
            labels: `https://${host}/${owner}/${repo}/labels`,
            milestones: `https://${host}/${owner}/${repo}/milestones`,
            newItem: `https://${host}/${owner}/${repo}/issues/new`,
        },
    };
}
