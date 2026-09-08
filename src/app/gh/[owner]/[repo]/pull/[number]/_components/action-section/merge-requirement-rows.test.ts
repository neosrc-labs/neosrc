import { describe, expect, it } from "vitest";
import type { CheckRun, MergeRequirements } from "~/server/github";
import type { PullRequestMergeState } from "~/server/github-graphql";
import {
    buildMergeRequirementRows,
    type MergeRequirementRow,
    summarizeMergeRequirements,
} from "./merge-requirement-rows";

function makeRequirements(
    overrides: Partial<MergeRequirements> = {},
): MergeRequirements {
    return {
        source: "ruleset",
        requiredApprovingReviewCount: 0,
        requiredChecks: [],
        requiresCodeOwnerReview: false,
        requiresLastPushApproval: false,
        dismissesStaleReviews: false,
        requiresConversationResolution: false,
        requiresUpToDateBranch: false,
        requiresLinearHistory: false,
        requiresSignedCommits: false,
        allowedMergeMethods: null,
        requiredDeploymentEnvironments: [],
        ...overrides,
    };
}

function makeMergeState(
    overrides: Partial<PullRequestMergeState> = {},
): PullRequestMergeState {
    return {
        mergeStateStatus: "BLOCKED",
        reviewDecision: null,
        viewerCanUpdateBranch: false,
        viewerCanMergeAsAdmin: false,
        isInMergeQueue: false,
        unresolvedThreadCount: 0,
        codeOwnerReviewerLogins: [],
        headSha: "abc123",
        requiredChecks: [],
        ...overrides,
    };
}

function makeCheckRun(overrides: Partial<CheckRun> = {}): CheckRun {
    return {
        name: "ci/test",
        status: "completed",
        conclusion: "success",
        ...overrides,
    };
}

function build(
    args: Partial<Parameters<typeof buildMergeRequirementRows>[0]> = {},
): MergeRequirementRow[] {
    return buildMergeRequirementRows({
        requirements: makeRequirements(),
        mergeState: null,
        checkRuns: [],
        approvalCount: 0,
        changesRequestedCount: 0,
        ...args,
    });
}

const rowFor = (rows: MergeRequirementRow[], key: string) =>
    rows.find((row) => row.key === key);

describe("buildMergeRequirementRows", () => {
    it("reports unresolved conversations as failing", () => {
        const rows = build({
            requirements: makeRequirements({
                requiresConversationResolution: true,
            }),
            mergeState: makeMergeState({ unresolvedThreadCount: 2 }),
        });

        expect(rowFor(rows, "conversations")).toMatchObject({
            label: "2 unresolved conversations",
            status: "failing",
        });
        expect(summarizeMergeRequirements(rows, 0)).toEqual(["2 unresolved"]);
    });

    it("reports resolved conversations as passing", () => {
        const rows = build({
            requirements: makeRequirements({
                requiresConversationResolution: true,
            }),
            mergeState: makeMergeState({ unresolvedThreadCount: 0 }),
        });

        expect(rowFor(rows, "conversations")).toMatchObject({
            label: "All conversations resolved",
            status: "passing",
        });
        expect(summarizeMergeRequirements(rows, 0)).toEqual([]);
    });

    it("omits the conversation row when the merge state is unknown", () => {
        const rows = build({
            requirements: makeRequirements({
                requiresConversationResolution: true,
                requiredChecks: ["ci/test"],
            }),
            mergeState: null,
            checkRuns: [makeCheckRun()],
        });

        expect(rowFor(rows, "conversations")).toBeUndefined();
        expect(rowFor(rows, "check:ci/test")).toMatchObject({
            status: "passing",
        });
    });

    it("fails the up-to-date row when the branch is behind", () => {
        const behind = build({
            requirements: makeRequirements({ requiresUpToDateBranch: true }),
            mergeState: makeMergeState({ mergeStateStatus: "BEHIND" }),
        });
        const clean = build({
            requirements: makeRequirements({ requiresUpToDateBranch: true }),
            mergeState: makeMergeState({ mergeStateStatus: "CLEAN" }),
        });

        expect(rowFor(behind, "up-to-date")).toMatchObject({
            label: "This branch is out of date with the base branch",
            status: "failing",
        });
        expect(summarizeMergeRequirements(behind, 0)).toEqual(["Out of date"]);
        expect(rowFor(clean, "up-to-date")).toMatchObject({
            label: "Branch is up to date",
            status: "passing",
        });
    });

    it("treats an action_required check run as failing", () => {
        const rows = build({
            requirements: makeRequirements({ requiredChecks: ["ci/test"] }),
            checkRuns: [
                makeCheckRun({
                    conclusion: "action_required",
                    html_url: "https://example.test/run",
                }),
            ],
        });

        expect(rowFor(rows, "check:ci/test")).toMatchObject({
            status: "failing",
            url: "https://example.test/run",
        });
        expect(summarizeMergeRequirements(rows, 0)).toEqual([
            "1 check failing",
        ]);
    });

    it("marks a required check with no run as pending", () => {
        const rows = build({
            requirements: makeRequirements({ requiredChecks: ["ci/missing"] }),
            checkRuns: [makeCheckRun()],
        });

        expect(rowFor(rows, "check:ci/missing")?.status).toBe("pending");
        expect(summarizeMergeRequirements(rows, 0)).toEqual([
            "1 check pending",
        ]);
    });

    it("prefers the GraphQL required checks over same-named fallback rows", () => {
        const rows = build({
            requirements: makeRequirements({ requiredChecks: ["CI/Test"] }),
            mergeState: makeMergeState({
                requiredChecks: [
                    {
                        name: "ci/test",
                        status: "failure",
                        url: "https://example.test/gql",
                    },
                ],
            }),
            checkRuns: [makeCheckRun()],
        });

        expect(rows.filter((row) => row.key.startsWith("check:"))).toEqual([
            {
                key: "check:ci/test",
                label: "ci/test",
                status: "failing",
                url: "https://example.test/gql",
            },
        ]);
    });

    it("counts approvals and changes requested", () => {
        const rows = build({
            requirements: makeRequirements({
                requiredApprovingReviewCount: 2,
            }),
            approvalCount: 1,
            changesRequestedCount: 1,
        });

        expect(rowFor(rows, "approvals")).toMatchObject({
            label: "1 of 2 approving reviews",
            status: "pending",
        });
        expect(summarizeMergeRequirements(rows, 3)).toEqual([
            "1/2 approvals",
            "1 change requested",
            "3 pending",
        ]);
    });

    it("passes the code owner and last push rows once the review decision is approved", () => {
        const pending = build({
            requirements: makeRequirements({
                requiresCodeOwnerReview: true,
                requiresLastPushApproval: true,
            }),
            mergeState: makeMergeState({ reviewDecision: "REVIEW_REQUIRED" }),
        });
        const approved = build({
            requirements: makeRequirements({
                requiresCodeOwnerReview: true,
                requiresLastPushApproval: true,
            }),
            mergeState: makeMergeState({ reviewDecision: "APPROVED" }),
        });

        expect(summarizeMergeRequirements(pending, 0)).toEqual([
            "Code owner review",
            "Last push approval",
        ]);
        expect(summarizeMergeRequirements(approved, 0)).toEqual([]);
    });

    it("returns no rows when requirements are unavailable", () => {
        expect(build({ requirements: null })).toEqual([]);
        expect(build({ requirements: undefined })).toEqual([]);
    });
});
