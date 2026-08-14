// @vitest-environment jsdom
import { createListTests } from "../helpers/list-test-factory";

createListTests({
    describeName: "IssueList",
    searchPlaceholder: "Search issues by title, body, or comments",
    searchNamespace: "issues",
    hasMergedTab: false,
    hasNewPullRequestLink: false,
    emptyState: {
        noOpen: "No open issues",
        noClosed: "No closed issues",
        noMatch: "No issues match your search",
    },
    loadComponent: () =>
        import("~/app/[owner]/[repo]/issues/_components/issue-list").then(
            (m) => m.IssueList,
        ),
});
