import type { StackSuggestion } from "~/server/github";

/** Shared stack suggestion fixture used by create-stack-dialog and stack-banner tests. */
export const STACK_SUGGESTION: StackSuggestion = {
    pullRequests: [
        {
            number: 10,
            title: "feature-a",
            state: "open",
            draft: false,
            headRef: "main",
        },
        {
            number: 11,
            title: "feature-b",
            state: "open",
            draft: false,
            headRef: "feature-a",
        },
    ],
    baseRef: "main",
};
