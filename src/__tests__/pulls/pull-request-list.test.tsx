// @vitest-environment jsdom
import { createListTests } from "../helpers/list-test-factory";

createListTests({
    describeName: "PullRequestList",
    searchPlaceholder: "Search pull requests by title, body, or comments",
    searchNamespace: "pulls",
    hasMergedTab: true,
    hasNewPullRequestLink: true,
    extraApiMocks: true,
    loadComponent: () =>
        import(
            "~/app/[owner]/[repo]/_components/repo-pages/pull-request-list"
        ).then((m) => m.PullRequestList),
});
