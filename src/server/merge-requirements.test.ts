import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/server/db", () => ({ db: {} }));

const { mockGetBranchRules, mockGetBranchProtection } = vi.hoisted(() => ({
    mockGetBranchRules: vi.fn(),
    mockGetBranchProtection: vi.fn(),
}));

vi.mock("@octokit/rest", () => ({
    Octokit: class {
        rest = {
            repos: {
                getBranchRules: mockGetBranchRules,
                getBranchProtection: mockGetBranchProtection,
            },
        };
    },
}));

import { getMergeRequirements } from "~/server/github";

describe("getMergeRequirements", () => {
    beforeEach(() => {
        mockGetBranchRules.mockReset();
        mockGetBranchProtection.mockReset();
    });

    it("returns requirements from the rulesets API", async () => {
        mockGetBranchRules.mockResolvedValue({
            data: [
                {
                    type: "pull_request",
                    parameters: {
                        required_approving_review_count: 2,
                    },
                },
                {
                    type: "required_status_checks",
                    parameters: {
                        required_status_checks: [
                            { context: "ci/test" },
                            { context: "ci/lint" },
                        ],
                    },
                },
            ],
        });

        await expect(
            getMergeRequirements("token", "owner", "repo", "rulesets"),
        ).resolves.toMatchObject({
            source: "ruleset",
            requiredApprovingReviewCount: 2,
            requiredChecks: ["ci/test", "ci/lint"],
        });
        expect(mockGetBranchProtection).not.toHaveBeenCalled();
    });

    it("maps the full ruleset payload", async () => {
        mockGetBranchRules.mockResolvedValue({
            data: [
                {
                    type: "pull_request",
                    parameters: {
                        required_approving_review_count: 1,
                        dismiss_stale_reviews_on_push: true,
                        require_code_owner_review: true,
                        require_last_push_approval: true,
                        required_review_thread_resolution: true,
                        allowed_merge_methods: ["squash"],
                    },
                },
                {
                    type: "required_status_checks",
                    parameters: {
                        required_status_checks: [
                            { context: "ci/test" },
                            { context: "ci/test" },
                        ],
                        strict_required_status_checks_policy: true,
                    },
                },
                { type: "required_signatures" },
                { type: "required_linear_history" },
                {
                    type: "required_deployments",
                    parameters: {
                        required_deployment_environments: ["staging"],
                    },
                },
            ],
        });

        await expect(
            getMergeRequirements("token", "owner", "repo", "full-ruleset"),
        ).resolves.toEqual({
            source: "ruleset",
            requiredApprovingReviewCount: 1,
            requiredChecks: ["ci/test"],
            requiresCodeOwnerReview: true,
            requiresLastPushApproval: true,
            dismissesStaleReviews: true,
            requiresConversationResolution: true,
            requiresUpToDateBranch: true,
            requiresLinearHistory: true,
            requiresSignedCommits: true,
            allowedMergeMethods: ["squash"],
            requiredDeploymentEnvironments: ["staging"],
        });
    });

    it("intersects allowed merge methods across pull_request rules", async () => {
        mockGetBranchRules.mockResolvedValue({
            data: [
                {
                    type: "pull_request",
                    parameters: {
                        required_approving_review_count: 0,
                        allowed_merge_methods: ["merge", "squash"],
                    },
                },
                {
                    type: "pull_request",
                    parameters: {
                        required_approving_review_count: 0,
                        allowed_merge_methods: ["squash", "rebase"],
                    },
                },
            ],
        });

        await expect(
            getMergeRequirements("token", "owner", "repo", "two-rules"),
        ).resolves.toMatchObject({ allowedMergeMethods: ["squash"] });
    });

    it("falls back to branch protection when rulesets are unavailable (404)", async () => {
        mockGetBranchRules.mockRejectedValue({ status: 404 });
        mockGetBranchProtection.mockResolvedValue({
            data: {
                required_pull_request_reviews: {
                    required_approving_review_count: 1,
                },
                required_status_checks: {
                    contexts: ["ci/test"],
                },
            },
        });

        await expect(
            getMergeRequirements("token", "owner", "repo", "fallback"),
        ).resolves.toMatchObject({
            source: "branch-protection",
            requiredApprovingReviewCount: 1,
            requiredChecks: ["ci/test"],
        });
    });

    it("maps conversation resolution and strict checks from branch protection", async () => {
        mockGetBranchRules.mockResolvedValue({ data: [] });
        mockGetBranchProtection.mockResolvedValue({
            data: {
                required_conversation_resolution: { enabled: true },
                required_status_checks: {
                    contexts: ["ci"],
                    strict: true,
                },
            },
        });

        await expect(
            getMergeRequirements("token", "owner", "repo", "classic"),
        ).resolves.toMatchObject({
            source: "branch-protection",
            requiresConversationResolution: true,
            requiresUpToDateBranch: true,
            requiredChecks: ["ci"],
            allowedMergeMethods: null,
        });
    });

    it("falls back to branch protection when rulesets require a paid plan (403)", async () => {
        mockGetBranchRules.mockRejectedValue({
            status: 403,
            message:
                "Upgrade to GitHub Pro or make this repository public to enable this feature.",
        });
        mockGetBranchProtection.mockResolvedValue({
            data: {
                required_pull_request_reviews: {
                    required_approving_review_count: 1,
                },
                required_status_checks: {
                    contexts: ["ci/test"],
                },
            },
        });

        await expect(
            getMergeRequirements("token", "owner", "repo", "paid-plan"),
        ).resolves.toMatchObject({
            requiredApprovingReviewCount: 1,
            requiredChecks: ["ci/test"],
        });
    });

    it("returns no requirements when branch protection requires a paid plan (403)", async () => {
        mockGetBranchRules.mockRejectedValue({ status: 404 });
        mockGetBranchProtection.mockRejectedValue({
            status: 403,
            message:
                "Upgrade to GitHub Pro or make this repository public to enable this feature.",
        });

        await expect(
            getMergeRequirements("token", "owner", "repo", "paid-plan"),
        ).resolves.toMatchObject({
            source: "none",
            requiredApprovingReviewCount: 0,
            requiredChecks: [],
        });
    });

    it("propagates other 403 rulesets failures (e.g. unrecognized permission denied)", async () => {
        mockGetBranchRules.mockRejectedValue({
            status: 403,
            message: "Forbidden",
        });

        await expect(
            getMergeRequirements("token", "owner", "repo", "forbidden"),
        ).rejects.toMatchObject({ status: 403 });
        expect(mockGetBranchProtection).not.toHaveBeenCalled();
    });

    it("treats an integration access 403 from rulesets as no requirements", async () => {
        mockGetBranchRules.mockRejectedValue({
            status: 403,
            message: "Resource not accessible by integration",
        });
        mockGetBranchProtection.mockRejectedValue({ status: 404 });

        await expect(
            getMergeRequirements("token", "owner", "repo", "integration-rules"),
        ).resolves.toMatchObject({
            source: "none",
            requiredApprovingReviewCount: 0,
            requiredChecks: [],
        });
    });

    it("treats an integration access 403 from branch protection as no requirements", async () => {
        mockGetBranchRules.mockRejectedValue({ status: 404 });
        mockGetBranchProtection.mockRejectedValue({
            status: 403,
            message: "Resource not accessible by integration",
        });

        await expect(
            getMergeRequirements("token", "owner", "repo", "integration-prot"),
        ).resolves.toMatchObject({
            source: "none",
            requiredApprovingReviewCount: 0,
            requiredChecks: [],
        });
    });

    it("returns no requirements when neither rulesets nor protection apply (404)", async () => {
        mockGetBranchRules.mockRejectedValue({ status: 404 });
        mockGetBranchProtection.mockRejectedValue({ status: 404 });

        await expect(
            getMergeRequirements("token", "owner", "repo", "unprotected"),
        ).resolves.toMatchObject({
            source: "none",
            requiredApprovingReviewCount: 0,
            requiredChecks: [],
        });
    });

    it("propagates non-404 rulesets failures instead of defaulting to no requirements", async () => {
        mockGetBranchRules.mockRejectedValue({ status: 500 });

        await expect(
            getMergeRequirements("token", "owner", "repo", "rules-fail"),
        ).rejects.toMatchObject({ status: 500 });
        expect(mockGetBranchProtection).not.toHaveBeenCalled();
    });

    it("propagates non-404 branch protection failures after a rulesets 404", async () => {
        mockGetBranchRules.mockRejectedValue({ status: 404 });
        mockGetBranchProtection.mockRejectedValue({ status: 429 });

        await expect(
            getMergeRequirements("token", "owner", "repo", "prot-fail"),
        ).rejects.toMatchObject({ status: 429 });
    });

    it("propagates non-HTTP failures (e.g. network errors)", async () => {
        mockGetBranchRules.mockRejectedValue(new Error("socket hang up"));

        await expect(
            getMergeRequirements("token", "owner", "repo", "network"),
        ).rejects.toThrow("socket hang up");
    });
});
