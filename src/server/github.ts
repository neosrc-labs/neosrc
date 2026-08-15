import { createHash } from "node:crypto";
import { graphql as octokitGraphql } from "@octokit/graphql";
import { Octokit, type RestEndpointMethodTypes } from "@octokit/rest";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { RefreshableAuth } from "~/server/auth";
import {
    prCacheKey,
    readCache,
    repoContributorsCacheKey,
    repoDocFilesCacheKey,
    repoIssuePullCountsCacheKey,
    repoLanguagesCacheKey,
    repoStarredCacheKey,
    repoSubscriptionCacheKey,
    withStaleWhileRevalidate,
} from "~/server/cache";
import {
    type GQLActor,
    type GQLCommitAuthor,
    type GQLPullRequestReactions,
    type GqlCommitChecks,
    getCommitChecksGraphQL,
    getPullRequestStackGraphQL,
    isOrgRestrictionError,
    isUnauthorizedError,
    resolveCommitAuthor,
    type StackData,
    type StackEntry,
} from "~/server/github-graphql";
import {
    getCachedRepoData,
    getRepoPermissionForUser,
    viewerRepoAccess,
} from "~/server/repo-cache";
import {
    buildStackSuggestion,
    MAX_STACK_SIZE,
    type StackCandidate,
    type StackSuggestion,
} from "~/server/stack-suggestion";
import { githubRepoToSyncRepo } from "~/server/sync/mappers";
import {
    deduplicateCommitStatuses,
    mapStatusToCheckRun,
} from "~/utils/status-checks";

export type {
    StackCandidate,
    StackSuggestion,
} from "~/server/stack-suggestion";
export type PullsGetResponseData =
    RestEndpointMethodTypes["pulls"]["get"]["response"]["data"] & {
        // TODO: This has not yet been added to the RestEndpointMethodTypes upstream yet. Should remove when we update
        stack?: {
            id: number;
            base: { ref: string; sha: string };
            size: number;
            number: number;
            position: number;
        };
    };
export type CommitData =
    RestEndpointMethodTypes["repos"]["getCommit"]["response"]["data"];
export type Label = NonNullable<PullsGetResponseData["labels"]>[number];
export type Reviewer = NonNullable<
    PullsGetResponseData["requested_reviewers"]
>[number];
export type Assignee = NonNullable<PullsGetResponseData["assignees"]>[number];
export type ReviewComment =
    RestEndpointMethodTypes["pulls"]["listReviewComments"]["response"]["data"][number];
export type ReviewComment2 =
    RestEndpointMethodTypes["pulls"]["listReviews"]["response"]["data"][number];
export type CommentForReview =
    RestEndpointMethodTypes["pulls"]["listCommentsForReview"]["response"]["data"][number];
/**
 * Shape shared by listReviewComments and listCommentsForReview items.
 * The Octokit types differ in position/original_position nullability and
 * user nullability, so components that mix both sources consume this.
 */
export type ReviewCommentBase = Omit<
    ReviewComment,
    "position" | "original_position" | "user"
> & {
    position?: number | null;
    original_position?: number | null;
    user: ReviewComment["user"] | null;
};
export type PullRequestFile =
    RestEndpointMethodTypes["pulls"]["listFiles"]["response"]["data"][number];
export type TeamGetByNameResponseData =
    RestEndpointMethodTypes["teams"]["getByName"]["response"]["data"];

export type CheckRun = {
    name: string;
    conclusion: string | null;
    status: string;
    description?: string | null;
    html_url?: string;
    details_url?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    app?: {
        name: string;
        owner?: {
            avatar_url: string;
        } | null;
    } | null;
    creator?: {
        login: string;
        avatar_url: string;
        html_url?: string;
    } | null;
};

export function createOctokit(auth: string | RefreshableAuth) {
    const refresh = (auth as RefreshableAuth).refresh;
    if (typeof refresh !== "function") {
        return new Octokit({ auth: String(auth) });
    }

    // The stored token may be dead while accessTokenExpiresAt still looks
    // valid (revoked or manually replaced token). Swap in a fresh token and
    // retry once when GitHub rejects the current one with a 401.
    let token = String(auth);
    let didRefresh = false;
    return new Octokit({
        authStrategy: (authOptions: {
            token: string;
            refresh: () => Promise<string>;
        }) => ({
            type: "token",
            token: authOptions.token,
            auth: async () => ({ type: "token", token, tokenType: "oauth" }),
            hook: async (
                request: {
                    endpoint: {
                        merge: (
                            route: string,
                            parameters?: Record<string, unknown>,
                        ) => { headers: Record<string, string> } & Record<
                            string,
                            unknown
                        >;
                    };
                    (options: object): Promise<unknown>;
                },
                route: string,
                parameters?: Record<string, unknown>,
            ) => {
                const endpoint = request.endpoint.merge(route, parameters);
                endpoint.headers.authorization = `token ${token}`;
                try {
                    return await request(endpoint);
                } catch (error) {
                    if (didRefresh || !isUnauthorizedError(error)) throw error;
                    didRefresh = true;
                    token = await authOptions.refresh();
                    endpoint.headers.authorization = `token ${token}`;
                    return request(endpoint);
                }
            },
        }),
        auth: { token: String(auth), refresh },
    });
}

export const getPullRequest = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        pullNumber: number,
    ): Promise<PullsGetResponseData> => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.pulls.get({
            owner,
            repo,
            pull_number: pullNumber,
        });
        return response.data;
    },
);

export async function getCachedPullRequest(
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    userId?: string | null,
): Promise<PullsGetResponseData> {
    const getOrThrow = async () => {
        try {
            return await getPullRequest(accessToken, owner, repo, pullNumber);
        } catch (error: unknown) {
            if (
                error &&
                typeof error === "object" &&
                "status" in error &&
                (error as { status: number }).status === 404
            ) {
                notFound();
            }
            throw error;
        }
    };

    const permission = userId
        ? await readCache<string>(`permission:${owner}:${repo}:${userId}`)
        : null;

    if (!permission || permission === "none") {
        return getOrThrow();
    }

    return withStaleWhileRevalidate(
        prCacheKey(owner, repo, pullNumber),
        getOrThrow,
        {
            staleAfter: 5 * 1000,
            deleteAfter: 3 * 60 * 1000,
        },
    );
}

export const getPullRequestStack = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        prNumber: number,
    ): Promise<StackData | null> => {
        try {
            return await getPullRequestStackGraphQL(
                accessToken,
                owner,
                repo,
                prNumber,
            );
        } catch {
            // TODO: Properly check the error

            // Currently there is a bug in the Github API where the stack `entries` in the GQL query
            // causes a 500. So for now we fallback to a REST query.
            // https://github.com/orgs/community/discussions/204626
            return await getPullRequestStackREST(
                accessToken,
                owner,
                repo,
                prNumber,
            );
        }
    },
);

// This is a hack due to the Github API having 500 errors in graphql API
async function getPullRequestStackREST(
    accessToken: string,
    owner: string,
    repo: string,
    prNumber: number,
): Promise<StackData | null> {
    const octokit = createOctokit(accessToken);
    const pr = await octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
    });
    if (pr.status !== 200) {
        return null;
    }

    const prData = pr.data as typeof pr.data & {
        stack?: { id: number; number: number };
    };

    if (!prData.stack) {
        // PR isn't part of a stack
        return null;
    }

    const res = await octokit.request(
        "GET /repos/{owner}/{repo}/stacks/{stack_number}",
        {
            owner,
            repo,
            stack_number: prData.stack.number,
        },
    );
    if (res.status !== 200) {
        return null;
    }

    const stack = res.data as {
        id: number;
        number: number;
        base: { ref: string };
        pull_requests: {
            number: number;
            title: string;
            state: "open" | "closed";
            merged_at: string | null;
            draft: boolean;
            head: { ref: string };
            base: { ref: string };
        }[];
    };

    const toEntryState = (
        entry: (typeof stack.pull_requests)[number],
    ): StackEntry["state"] =>
        entry.merged_at !== null
            ? "merged"
            : entry.state === "open"
              ? "open"
              : "closed";

    const pullRequests: StackEntry[] = stack.pull_requests
        .map((entry, index) => ({
            number: entry.number,
            position: index + 1,
            state: toEntryState(entry),
            draft: entry.draft,
            title: entry.title,
            mergeable: "UNKNOWN" as "CONFLICTING" | "MERGEABLE" | "UNKNOWN",
            headRef: entry.head.ref,
        }))
        .reverse();

    for (const pr of pullRequests) {
        if (pr.state === "open") {
            const fullPr = await getPullRequest(
                accessToken,
                owner,
                repo,
                pr.number,
            );
            pr.mergeable =
                fullPr.mergeable === true
                    ? "MERGEABLE"
                    : fullPr.mergeable === false
                      ? "CONFLICTING"
                      : "UNKNOWN";
        }
    }

    return {
        id: stack.id,
        number: stack.number,
        baseRef: stack.base.ref,
        open: true as const,
        createdAt: "",
        pullRequests,
    };
}

async function findOpenPullRequestByHead(
    accessToken: string,
    owner: string,
    repo: string,
    headRef: string,
): Promise<StackCandidate | null> {
    const octokit = createOctokit(accessToken);
    const response = await octokit.pulls.list({
        owner,
        repo,
        state: "open",
        head: `${owner}:${headRef}`,
        per_page: 100,
    });

    for (const pr of response.data) {
        const stack = (pr as { stack?: unknown }).stack;
        if (stack || pr.base.ref === pr.head.ref) {
            continue;
        }
        return {
            number: pr.number,
            title: pr.title,
            state: "open",
            draft: pr.draft ?? false,
            headRef: pr.head.ref,
            baseRef: pr.base.ref,
        };
    }
    return null;
}

/**
 * When the current PR is not yet stacked and its base branch is the head of
 * an open PR (or a chain of them), returns the chain that could be turned
 * into a stack. Mirrors GitHub's recommendation banner: each PR's base
 * branch is the head branch of the PR below it. Capped at
 * {@link MAX_STACK_SIZE} PRs.
 */
export const getStackSuggestion = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        pullNumber: number,
    ): Promise<StackSuggestion | null> => {
        const pr = await getPullRequest(accessToken, owner, repo, pullNumber);
        if (pr.state !== "open" || pr.stack) {
            return null;
        }

        return buildStackSuggestion(
            {
                number: pr.number,
                title: pr.title,
                state: pr.state,
                draft: pr.draft ?? false,
                headRef: pr.head.ref,
                baseRef: pr.base.ref,
            },
            (headRef) =>
                findOpenPullRequestByHead(accessToken, owner, repo, headRef),
        );
    },
);

export const listPullRequests = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        state: "open" | "closed" | "all" = "open",
        page: number = 1,
        perPage: number = 30,
    ) => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.pulls.list({
            owner,
            repo,
            state,
            page,
            per_page: perPage,
        });
        return {
            pulls: response.data,
            hasNext: response.data.length >= perPage,
        };
    },
);

export const updatePullRequest = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    options: { body?: string; title?: string; state?: "open" | "closed" },
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.pulls.update({
        owner,
        repo,
        pull_number: pullNumber,
        ...options,
    });
    return response.data;
};

export const markPullRequestAsDraft = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
) => {
    const octokit = createOctokit(accessToken);
    const { data: pr } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
    });

    // For some reason the GitHub REST API just doesn't let you update the status of the PR to draft!?
    // The graphql endpoint does work however.
    const graphql = octokitGraphql.defaults({
        headers: { authorization: `bearer ${accessToken}` },
    });

    const query = `
mutation($pullRequestId: ID!) {
  convertPullRequestToDraft(input: { pullRequestId: $pullRequestId }) {
    pullRequest {
      id
      isDraft
    }
  }
}`;

    await graphql<{
        convertPullRequestToDraft: {
            pullRequest: { id: string; isDraft: boolean };
        };
    }>(query, { pullRequestId: pr.node_id });

    return pr;
};

export const markPullRequestAsReady = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
) => {
    const octokit = createOctokit(accessToken);
    const { data: pr } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
    });

    const graphql = octokitGraphql.defaults({
        headers: { authorization: `bearer ${accessToken}` },
    });

    const query = `
mutation($pullRequestId: ID!) {
  markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
    pullRequest {
      id
      isDraft
    }
  }
}`;

    await graphql<{
        markPullRequestReadyForReview: {
            pullRequest: { id: string; isDraft: boolean };
        };
    }>(query, { pullRequestId: pr.node_id });

    return pr;
};

export type RevertPullRequestResult = {
    number: number;
    url: string;
};

export const revertPullRequest = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    title?: string,
    body?: string,
    draft?: boolean,
): Promise<RevertPullRequestResult> => {
    const octokit = createOctokit(accessToken);
    const { data: pr } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
    });

    const graphql = octokitGraphql.defaults({
        headers: { authorization: `bearer ${accessToken}` },
    });

    const query = `
mutation($input: RevertPullRequestInput!) {
  revertPullRequest(input: $input) {
    revertPullRequest {
      number
      url
    }
  }
}`;

    const result = await graphql<{
        revertPullRequest?: {
            revertPullRequest?: { number: number; url: string } | null;
        } | null;
    }>(query, {
        input: {
            pullRequestId: pr.node_id,
            title: title ?? undefined,
            body: body ?? undefined,
            draft: draft ?? undefined,
        },
    });

    const revertPr = result.revertPullRequest?.revertPullRequest;
    if (!revertPr) {
        throw new Error("Failed to revert pull request: no revert PR returned");
    }

    return {
        number: revertPr.number,
        url: revertPr.url,
    };
};

export type MergeMethod = "merge" | "squash" | "rebase";

export const mergePullRequest = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    mergeMethod: MergeMethod,
    commitTitle?: string,
    commitMessage?: string,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.pulls.merge({
        owner,
        repo,
        pull_number: pullNumber,
        merge_method: mergeMethod,
        commit_title: commitTitle,
        commit_message: commitMessage,
    });
    return response.data;
};

export const mergePullRequestAsync = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    mergeMethod: MergeMethod,
    commitTitle?: string,
    commitMessage?: string,
) => {
    const octokit = createOctokit(accessToken);
    const body: Record<string, unknown> = {
        owner,
        repo,
        pull_number: pullNumber,
        merge_method: mergeMethod,
    };
    if (commitTitle !== undefined) body.commit_title = commitTitle;
    if (commitMessage !== undefined) body.commit_message = commitMessage;
    const response = await octokit.request(
        "PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge-async",
        body,
    );
    return response.data as {
        status: "pending" | "merged" | "enqueued" | "failed";
        details: { message: string; uuid?: string; sha?: string };
    };
};

export type MergeAsyncResult = {
    status: "pending" | "merged" | "enqueued" | "failed";
    details: { message: string; uuid?: string; sha?: string };
};

export const getMergeAsyncResult = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    uuid: string,
): Promise<MergeAsyncResult> => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/merge-async/{uuid}",
        { owner, repo, pull_number: pullNumber, uuid },
    );
    return response.data as MergeAsyncResult;
};

export const unstackPullRequests = async (
    accessToken: string,
    owner: string,
    repo: string,
    stackNumber: number,
): Promise<void> => {
    const octokit = createOctokit(accessToken);
    await octokit.request(
        "POST /repos/{owner}/{repo}/stacks/{stack_number}/unstack",
        {
            owner,
            repo,
            stack_number: stackNumber,
            headers: {
                "X-GitHub-Api-Version": "2026-03-10",
            },
        },
    );
};

export const createPullRequestStack = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullRequests: number[],
): Promise<void> => {
    const octokit = createOctokit(accessToken);
    await octokit.request("POST /repos/{owner}/{repo}/stacks", {
        owner,
        repo,
        pull_requests: pullRequests,
        headers: {
            "X-GitHub-Api-Version": "2026-03-10",
        },
    });
};

export const createIssueComment = async (
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
    body: string,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body,
    });
    return response.data;
};

export const updateIssueComment = async (
    accessToken: string,
    owner: string,
    repo: string,
    commentId: number,
    body: string,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.issues.updateComment({
        owner,
        repo,
        comment_id: commentId,
        body,
    });
    return response.data;
};

export const deleteIssueComment = async (
    accessToken: string,
    owner: string,
    repo: string,
    commentId: number,
) => {
    const octokit = createOctokit(accessToken);
    await octokit.issues.deleteComment({
        owner,
        repo,
        comment_id: commentId,
    });
};

export const updateReviewComment = async (
    accessToken: string,
    owner: string,
    repo: string,
    commentId: number,
    body: string,
    pullNumber?: number,
) => {
    const octokit = createOctokit(accessToken);
    try {
        const response = await octokit.pulls.updateReviewComment({
            owner,
            repo,
            comment_id: commentId,
            body,
        });
        return response.data;
    } catch (error) {
        if (
            pullNumber == null ||
            (error as { status?: number }).status !== 404
        ) {
            throw error;
        }

        const reviews = await getPullRequestReviews(
            accessToken,
            owner,
            repo,
            pullNumber,
        );
        for (const review of reviews.filter((r) => r.state === "PENDING")) {
            const comments = await getPullRequestReviewCommentsForReview(
                accessToken,
                owner,
                repo,
                pullNumber,
                review.id,
            );
            const comment = comments.find(
                (candidate) => candidate.id === commentId,
            );
            if (!comment?.node_id) continue;

            await updatePendingPullRequestReviewComment(
                accessToken,
                comment.node_id,
                body,
            );
            return comment;
        }

        throw error;
    }
};

async function updatePendingPullRequestReviewComment(
    accessToken: string,
    commentNodeId: string,
    body: string,
) {
    const graphql = octokitGraphql.defaults({
        headers: { authorization: `bearer ${accessToken}` },
    });

    const result = await graphql<{
        updatePullRequestReviewComment: {
            pullRequestReviewComment: { body: string };
        };
    }>(
        `
        mutation($commentId: ID!, $body: String!) {
            updatePullRequestReviewComment(
                input: {
                    pullRequestReviewCommentId: $commentId
                    body: $body
                }
            ) {
                pullRequestReviewComment {
                    body
                }
            }
        }
    `,
        { commentId: commentNodeId, body },
    );

    const readback = await graphql<{
        node: { body: string } | null;
    }>(
        `
        query($commentId: ID!) {
            node(id: $commentId) {
                ... on PullRequestReviewComment {
                    body
                }
            }
        }
    `,
        { commentId: commentNodeId },
    );

    if (
        result.updatePullRequestReviewComment.pullRequestReviewComment.body !==
            body ||
        readback.node?.body !== body
    ) {
        throw new Error("GitHub did not update the pending review comment");
    }
}

export const updatePullRequestReview = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    reviewId: number,
    body: string,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.pulls.updateReview({
        owner,
        repo,
        pull_number: pullNumber,
        review_id: reviewId,
        body,
    });
    return response.data;
};

export const createPullRequestReview = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    event?: "APPROVE" | "COMMENT" | "REQUEST_CHANGES",
    body?: string,
    comments?: Array<{
        path: string;
        line: number;
        side: string;
        body: string;
    }>,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        event,
        body,
        comments,
    });
    return response.data;
};

export type MergeRequirements = {
    requiredApprovingReviewCount: number;
    requiredChecks: string[];
};

/**
 * Octokit's RequestError carries an HTTP status; 404 marks an endpoint as
 * "not applicable" (rulesets unavailable, branch protection unconfigured)
 * rather than a genuine failure.
 */
function isNotFoundError(error: unknown): boolean {
    return (
        error !== null &&
        typeof error === "object" &&
        "status" in error &&
        (error as { status: number }).status === 404
    );
}

/**
 * GitHub returns 403 with this message on private repositories whose plan
 * does not include the feature (rulesets and branch protection both require
 * GitHub Pro on private repos). Like 404, it means "no requirements can
 * exist here" rather than a genuine failure.
 */
function isFeatureUnavailableError(error: unknown): boolean {
    if (
        error === null ||
        typeof error !== "object" ||
        !("status" in error) ||
        error.status !== 403 ||
        !("message" in error)
    ) {
        return false;
    }
    return (
        typeof error.message === "string" &&
        error.message.includes(
            "make this repository public to enable this feature",
        )
    );
}

export const getMergeRequirements = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        branch: string,
    ): Promise<MergeRequirements> => {
        const octokit = createOctokit(accessToken);

        let requiredApprovingReviewCount = 0;
        const requiredChecks: string[] = [];

        try {
            const { data: rulesData } = await octokit.rest.repos.getBranchRules(
                {
                    owner,
                    repo,
                    branch,
                },
            );

            if (rulesData.length > 0) {
                for (const rule of rulesData) {
                    if (
                        rule.type === "pull_request" &&
                        rule.parameters &&
                        "required_approving_review_count" in rule.parameters
                    ) {
                        const count =
                            rule.parameters.required_approving_review_count;
                        if (count > requiredApprovingReviewCount) {
                            requiredApprovingReviewCount = count;
                        }
                    }
                    if (
                        rule.type === "required_status_checks" &&
                        rule.parameters &&
                        "required_status_checks" in rule.parameters
                    ) {
                        for (const checkConfig of rule.parameters
                            .required_status_checks) {
                            if (checkConfig.context) {
                                requiredChecks.push(checkConfig.context);
                            }
                        }
                    }
                }
                return { requiredApprovingReviewCount, requiredChecks };
            }
        } catch (error) {
            // Rulesets are only available on repos that use them; fall back
            // to classic branch protection when the endpoint is not applicable
            // (404) or the feature is unavailable on the repo's plan (403 on
            // private repos without GitHub Pro). Any other failure means the
            // requirements could not be determined and must surface rather
            // than defaulting to none.
            if (!isNotFoundError(error) && !isFeatureUnavailableError(error)) {
                throw error;
            }
        }

        try {
            const { data: protection } =
                await octokit.rest.repos.getBranchProtection({
                    owner,
                    repo,
                    branch,
                });

            if (protection.required_pull_request_reviews) {
                requiredApprovingReviewCount =
                    protection.required_pull_request_reviews
                        .required_approving_review_count ?? 0;
            }

            if (protection.required_status_checks) {
                for (const context of protection.required_status_checks
                    .contexts) {
                    requiredChecks.push(context);
                }
            }
        } catch (error) {
            // Branch protection may simply not be configured (404), or may
            // be unavailable on the repo's plan (403 on private repos without
            // GitHub Pro) — both mean there are no requirements. Any other
            // failure must surface.
            if (!isNotFoundError(error) && !isFeatureUnavailableError(error)) {
                throw error;
            }
        }

        return { requiredApprovingReviewCount, requiredChecks };
    },
);

export const getPullRequestReviews = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        pullNumber: number,
    ): Promise<ReviewComment2[]> => {
        const octokit = createOctokit(accessToken);
        const allReviews = await octokit.paginate(
            octokit.rest.pulls.listReviews,
            {
                owner,
                repo,
                pull_number: pullNumber,
                per_page: 100,
            },
        );
        return allReviews;
    },
);

export const submitPullRequestReview = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    reviewId: number,
    event: "APPROVE" | "COMMENT" | "REQUEST_CHANGES",
    body?: string,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.pulls.submitReview({
        owner,
        repo,
        pull_number: pullNumber,
        review_id: reviewId,
        event,
        body,
    });
    return response.data;
};

export const deletePendingReview = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    reviewId: number,
) => {
    const octokit = createOctokit(accessToken);
    await octokit.pulls.deletePendingReview({
        owner,
        repo,
        pull_number: pullNumber,
        review_id: reviewId,
    });
};

export const getConflictedFiles = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        baseSha: string,
        headSha: string,
    ): Promise<string[]> => {
        const octokit = createOctokit(accessToken);

        const comparison = await octokit.request(
            "GET /repos/{owner}/{repo}/compare/{basehead}",
            {
                owner,
                repo,
                basehead: `${baseSha}...${headSha}`,
            },
        );

        const mergeBaseSha = comparison.data.merge_base_commit.sha;

        const baseComparison = await octokit.request(
            "GET /repos/{owner}/{repo}/compare/{basehead}",
            {
                owner,
                repo,
                basehead: `${mergeBaseSha}...${baseSha}`,
            },
        );

        const baseChangedFiles = new Set(
            (baseComparison.data.files ?? []).map(
                (f: { filename: string }) => f.filename,
            ),
        );

        const prChangedFiles = comparison.data.files ?? [];

        return prChangedFiles
            .filter((f: { filename: string }) =>
                baseChangedFiles.has(f.filename),
            )
            .map((f: { filename: string }) => f.filename);
    },
);

export const getChecksForCommit = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        commitSha: string,
    ): Promise<CheckRun[]> => {
        let checks: GqlCommitChecks;
        try {
            checks = await getCommitChecksGraphQL(
                accessToken,
                owner,
                repo,
                commitSha,
            );
        } catch (error) {
            if (!isOrgRestrictionError(error)) throw error;
            checks = await getCommitChecksRest(
                accessToken,
                owner,
                repo,
                commitSha,
            );
        }

        const checkRunItems = checks.checkRuns.map((check) => ({
            name: check.name,
            conclusion: check.conclusion,
            status: check.status,
            description: check.title ?? check.summary,
            html_url: check.url ?? undefined,
            details_url: check.detailsUrl,
            started_at: check.startedAt,
            completed_at: check.completedAt,
            app: check.app
                ? {
                      name: check.app.name,
                      owner: check.app.logoUrl
                          ? { avatar_url: check.app.logoUrl }
                          : null,
                  }
                : null,
        }));

        const statusItems = deduplicateCommitStatuses(
            checks.statuses.map((s) => ({
                state: s.state,
                target_url: s.targetUrl,
                description: s.description,
                context: s.context,
                created_at: s.createdAt,
                updated_at: s.updatedAt,
                creator: s.creator
                    ? {
                          login: s.creator.login,
                          avatar_url: s.creator.avatarUrl,
                          html_url: s.creator.url,
                      }
                    : null,
            })),
        ).map(mapStatusToCheckRun);

        return [...checkRunItems, ...statusItems];
    },
);

/**
 * REST fallback for getCommitChecksGraphQL. Organizations with OAuth App
 * access restrictions enabled reject graphql even for public repository
 * data, so the same data comes from checks.listForRef and
 * repos.listCommitStatusesForRef instead.
 */
async function getCommitChecksRest(
    accessToken: string,
    owner: string,
    repo: string,
    commitSha: string,
): Promise<GqlCommitChecks> {
    const octokit = createOctokit(accessToken);
    const [checkRunsRes, statusesRes] = await Promise.all([
        octokit.checks.listForRef({ owner, repo, ref: commitSha }),
        octokit.repos.listCommitStatusesForRef({
            owner,
            repo,
            ref: commitSha,
        }),
    ]);

    const checkRuns = checkRunsRes.data.check_runs.map((run) => ({
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        title: run.output?.title ?? null,
        summary: run.output?.summary ?? null,
        detailsUrl: run.details_url ?? null,
        url: run.html_url ?? null,
        startedAt: run.started_at ?? null,
        completedAt: run.completed_at ?? null,
        // REST check runs carry the app name but not its logo.
        app: run.app ? { name: run.app.name, logoUrl: null } : null,
    }));

    const statuses = statusesRes.data.map((s) => ({
        context: s.context,
        description: s.description ?? null,
        state: s.state.toLowerCase(),
        targetUrl: s.target_url ?? null,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        creator: s.creator
            ? {
                  login: s.creator.login,
                  avatarUrl: s.creator.avatar_url,
                  url: s.creator.html_url,
              }
            : null,
    }));

    return { checkRuns, statuses };
}

const getCommit = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        commitSha: string,
    ) => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.repos.getCommit({
            owner,
            repo,
            ref: commitSha,
        });
        return response.data;
    },
);

export async function getCachedCommit(
    accessToken: string,
    owner: string,
    repo: string,
    commitSha: string,
    userId?: string | null,
): Promise<CommitData> {
    const permission = userId
        ? await readCache<string>(`permission:${owner}:${repo}:${userId}`)
        : null;

    if (!permission || permission === "none") {
        return getCommit(accessToken, owner, repo, commitSha);
    }

    return withStaleWhileRevalidate(
        `commit:${owner}:${repo}:${commitSha}`,
        () => getCommit(accessToken, owner, repo, commitSha),
        {
            staleAfter: 6 * 60 * 60 * 1000,
            deleteAfter: 7 * 24 * 60 * 60 * 1000,
        },
    );
}

export const getPullRequestReactions = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        pullNumber: number,
    ) => {
        const octokit = createOctokit(accessToken);
        const allReactions = await octokit.paginate(
            octokit.rest.reactions.listForIssue,
            { owner, repo, issue_number: pullNumber, per_page: 100 },
        );
        return allReactions;
    },
);

/**
 * REST fallback for getPullRequestReactionsGraphQL, mirroring its shape:
 * one page of reactions plus the issue-level reactions summary for the
 * per-content totals.
 */
export async function getPullRequestReactionsRest(
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
): Promise<GQLPullRequestReactions> {
    const octokit = createOctokit(accessToken);
    const [reactionsRes, issueRes] = await Promise.all([
        octokit.rest.reactions.listForIssue({
            owner,
            repo,
            issue_number: pullNumber,
            per_page: 100,
        }),
        octokit.rest.issues.get({ owner, repo, issue_number: pullNumber }),
    ]);

    const reactions = reactionsRes.data.map((r) => ({
        id: r.id,
        node_id: r.node_id,
        content: r.content.toLowerCase(),
        created_at: r.created_at,
        user: r.user,
    }));

    const summary = issueRes.data.reactions;
    const counts: GQLPullRequestReactions["counts"] = {
        total_count: summary?.total_count ?? 0,
        "+1": summary?.["+1"] ?? 0,
        "-1": summary?.["-1"] ?? 0,
        laugh: summary?.laugh ?? 0,
        confused: summary?.confused ?? 0,
        heart: summary?.heart ?? 0,
        hooray: summary?.hooray ?? 0,
        rocket: summary?.rocket ?? 0,
        eyes: summary?.eyes ?? 0,
    };

    return { reactions, counts };
}

export const getIssueCommentReactions = async (
    accessToken: string,
    owner: string,
    repo: string,
    commentId: number,
) => {
    const octokit = createOctokit(accessToken);
    const allReactions = await octokit.paginate(
        octokit.rest.reactions.listForIssueComment,
        { owner, repo, comment_id: commentId, per_page: 100 },
    );
    return allReactions;
};

export const createIssueCommentReaction = async (
    accessToken: string,
    owner: string,
    repo: string,
    commentId: number,
    content: string,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.rest.reactions.createForIssueComment({
        owner,
        repo,
        comment_id: commentId,
        content: content as
            | "+1"
            | "-1"
            | "laugh"
            | "confused"
            | "heart"
            | "hooray"
            | "rocket"
            | "eyes",
    });
    return response.data;
};

export const deleteIssueCommentReaction = async (
    accessToken: string,
    owner: string,
    repo: string,
    commentId: number,
    reactionId: number,
) => {
    const octokit = createOctokit(accessToken);
    await octokit.rest.reactions.deleteForIssueComment({
        owner,
        repo,
        comment_id: commentId,
        reaction_id: reactionId,
    });
};

export const getPullRequestReviewCommentReactions = async (
    accessToken: string,
    owner: string,
    repo: string,
    commentId: number,
) => {
    const octokit = createOctokit(accessToken);
    const allReactions = await octokit.paginate(
        octokit.rest.reactions.listForPullRequestReviewComment,
        { owner, repo, comment_id: commentId, per_page: 100 },
    );
    return allReactions;
};

export const createPullRequestReviewCommentReaction = async (
    accessToken: string,
    owner: string,
    repo: string,
    commentId: number,
    content: string,
) => {
    const octokit = createOctokit(accessToken);
    const response =
        await octokit.rest.reactions.createForPullRequestReviewComment({
            owner,
            repo,
            comment_id: commentId,
            content: content as
                | "+1"
                | "-1"
                | "laugh"
                | "confused"
                | "heart"
                | "hooray"
                | "rocket"
                | "eyes",
        });
    return response.data;
};

export const deletePullRequestReviewCommentReaction = async (
    accessToken: string,
    owner: string,
    repo: string,
    commentId: number,
    reactionId: number,
) => {
    const octokit = createOctokit(accessToken);
    await octokit.rest.reactions.deleteForPullRequestComment({
        owner,
        repo,
        comment_id: commentId,
        reaction_id: reactionId,
    });
};

export const createIssueReaction = async (
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
    content: string,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.rest.reactions.createForIssue({
        owner,
        repo,
        issue_number: issueNumber,
        content: content as
            | "+1"
            | "-1"
            | "laugh"
            | "confused"
            | "heart"
            | "hooray"
            | "rocket"
            | "eyes",
    });
    return response.data;
};

export const deleteIssueReaction = async (
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
    reactionId: number,
) => {
    const octokit = createOctokit(accessToken);
    await octokit.rest.reactions.deleteForIssue({
        owner,
        repo,
        issue_number: issueNumber,
        reaction_id: reactionId,
    });
};

export const getAuthenticatedUser = cache(async (accessToken: string) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.rest.users.getAuthenticated();
    return response.data;
});

export const getUserRepoPermission = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        username: string,
        userId: string,
    ) => {
        return withStaleWhileRevalidate(
            `permission:${owner}:${repo}:${userId}`,
            async () => {
                const octokit = createOctokit(accessToken);
                try {
                    const response =
                        await octokit.rest.repos.getCollaboratorPermissionLevel(
                            {
                                owner,
                                repo,
                                username,
                            },
                        );
                    return response.data.permission as
                        | "admin"
                        | "write"
                        | "read"
                        | "none";
                } catch (error) {
                    const status = (error as { status?: number } | null)
                        ?.status;
                    // 404: the user is not a collaborator, so they have no
                    // access. Return "none" so it is cached instead of
                    // re-fetching on every page view.
                    if (status === 404) {
                        return "none" as const;
                    }
                    throw error;
                }
            },
            { staleAfter: 5 * 60 * 1000, deleteAfter: 6 * 60 * 60 * 1000 },
        );
    },
);

/**
 * Resolves every collaborator's effective base permission for the repo in one
 * (paginated) call, keyed by login. The endpoint requires write/maintain/admin
 * access, so this returns null when the caller cannot list collaborators;
 * callers should fall back to per-user lookups via getUserRepoPermission.
 * Absent users have no access.
 */
export const getRepoCollaboratorPermissions = cache(
    async (
        accessToken: string,
        userId: string,
        owner: string,
        repo: string,
    ): Promise<Record<string, "admin" | "write" | "read" | "none"> | null> => {
        return withStaleWhileRevalidate(
            `gh:collaborators:${userId}:${owner}:${repo}`,
            async () => {
                const octokit = createOctokit(accessToken);
                const permissions: Record<
                    string,
                    "admin" | "write" | "read" | "none"
                > = {};
                try {
                    let page = 1;
                    for (;;) {
                        const response =
                            await octokit.rest.repos.listCollaborators({
                                owner,
                                repo,
                                per_page: 100,
                                page,
                            });
                        for (const collaborator of response.data) {
                            const p = collaborator.permissions;
                            // The permissions hash uses the legacy base roles:
                            // maintain implies push (write) and triage implies
                            // pull (read), matching getCollaboratorPermissionLevel.
                            permissions[collaborator.login] = p?.admin
                                ? "admin"
                                : p?.push
                                  ? "write"
                                  : p?.pull
                                    ? "read"
                                    : "none";
                        }
                        if (response.data.length < 100) break;
                        page += 1;
                    }
                    return permissions;
                } catch {
                    return null;
                }
            },
            { staleAfter: 5 * 60 * 1000, deleteAfter: 6 * 60 * 60 * 1000 },
        );
    },
);

export type IssueSearchItem = {
    number: number;
    title: string;
    state: string;
    type: "issue" | "pull_request";
    user: { login: string } | null;
};

export const searchIssues = cache(
    async (accessToken: string, owner: string, repo: string, query: string) => {
        const octokit = createOctokit(accessToken);
        const q = query
            ? `repo:${owner}/${repo} state:open ${query} in:title`
            : `repo:${owner}/${repo} state:open`;
        const response = await octokit.search.issuesAndPullRequests({
            q,
            per_page: 5,
            sort: "updated",
            order: "desc",
        });
        return response.data.items.map(
            (item): IssueSearchItem => ({
                number: item.number,
                title: item.title,
                state: item.state,
                type: item.pull_request ? "pull_request" : "issue",
                user: item.user ? { login: item.user.login } : null,
            }),
        );
    },
);

export const getPullRequestReviewComments = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        pullNumber: number,
    ): Promise<ReviewComment[]> => {
        const octokit = createOctokit(accessToken);
        const comments = await octokit.paginate(
            octokit.rest.pulls.listReviewComments,
            {
                owner,
                repo,
                pull_number: pullNumber,
                per_page: 100,
            },
        );
        return comments;
    },
);

export const getPullRequestReviewCommentsForReview = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    reviewId: number,
): Promise<CommentForReview[]> => {
    const octokit = createOctokit(accessToken);
    const comments = await octokit.paginate(
        octokit.rest.pulls.listCommentsForReview,
        {
            owner,
            repo,
            pull_number: pullNumber,
            review_id: reviewId,
            per_page: 100,
        },
    );
    return comments;
};

export const createPullRequestReviewComment = async (
    accessToken: string,
    pullRequestNodeId: string,
    path: string,
    line: number,
    side: "LEFT" | "RIGHT",
    body: string,
    pullRequestReviewNodeId?: string,
    startLine?: number,
    startSide?: "LEFT" | "RIGHT",
) => {
    // NOTE: Okay, I am really sad about this, but it seems that REST API just does not support adding comments to unsubmitted reviews...
    // https://docs.github.com/en/graphql/reference/mutations#addpullrequestreviewthread
    const variables: Record<string, unknown> = {
        pullRequestId: pullRequestNodeId,
        pullRequestReviewId: pullRequestReviewNodeId,
        body,
        path,
        line,
        side,
    };
    if (startLine != null) variables.startLine = startLine;
    if (startSide != null) variables.startSide = startSide;

    const graphql = octokitGraphql.defaults({
        headers: { authorization: `bearer ${accessToken}` },
    });

    const query = `
mutation($pullRequestId: ID!, $pullRequestReviewId: ID, $body: String!, $path: String!, $line: Int!, $side: DiffSide!, $startLine: Int, $startSide: DiffSide) {
  addPullRequestReviewThread(input: { pullRequestId: $pullRequestId, pullRequestReviewId: $pullRequestReviewId, body: $body, path: $path, line: $line, side: $side, startLine: $startLine, startSide: $startSide }) {
    thread {
      comments(first: 1) {
        nodes {
          databaseId
        }
      }
    }
  }
}`;

    const result = await graphql<{
        addPullRequestReviewThread: {
            thread: {
                comments: { nodes: [{ databaseId: number }] };
            };
        };
    }>(query, variables);

    const comment = result.addPullRequestReviewThread.thread.comments.nodes[0];
    return { id: comment.databaseId };
};

export const createStandaloneReviewComment = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
    commitId: string,
    path: string,
    line: number,
    side: "LEFT" | "RIGHT",
    startLine?: number,
    startSide?: "LEFT" | "RIGHT",
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.pulls.createReviewComment({
        owner,
        repo,
        pull_number: pullNumber,
        body,
        commit_id: commitId,
        path,
        line,
        side,
        ...(startLine != null ? { start_line: startLine } : {}),
        ...(startSide != null ? { start_side: startSide } : {}),
    });
    return { id: response.data.id };
};

export const createStandaloneFileComment = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
    commitId: string,
    path: string,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.pulls.createReviewComment({
        owner,
        repo,
        pull_number: pullNumber,
        body,
        commit_id: commitId,
        path,
        subject_type: "file",
    });
    return { id: response.data.id };
};

export const replyToPullRequestReviewComment = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
    inReplyTo: number,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.pulls.createReplyForReviewComment({
        owner,
        repo,
        pull_number: pullNumber,
        comment_id: inReplyTo,
        body,
    });
    return response.data;
};

export const deleteReviewComment = async (
    accessToken: string,
    owner: string,
    repo: string,
    commentId: number,
) => {
    const octokit = createOctokit(accessToken);
    await octokit.pulls.deleteReviewComment({
        owner,
        repo,
        comment_id: commentId,
    });
};

export type ReviewMinimizeClassifier =
    | "OUTDATED"
    | "OFF_TOPIC"
    | "DUPLICATE"
    | "SPAM"
    | "ABUSE";

export const minimizePullRequestReview = async (
    accessToken: string,
    subjectId: string,
    classifier: ReviewMinimizeClassifier,
) => {
    const graphql = octokitGraphql.defaults({
        headers: { authorization: `bearer ${accessToken}` },
    });

    const query = `
mutation($subjectId: ID!, $classifier: ReportedContentClassifiers!) {
  minimizeComment(input: { subjectId: $subjectId, classifier: $classifier }) {
    minimizedComment {
      ... on PullRequestReview {
        databaseId
        isMinimized
        minimizedReason
      }
    }
  }
}`;

    await graphql<{
        minimizeComment: {
            minimizedComment: {
                databaseId: number;
                isMinimized: boolean;
                minimizedReason: string | null;
            } | null;
        };
    }>(query, { subjectId, classifier });
};

export const unminimizePullRequestReview = async (
    accessToken: string,
    subjectId: string,
) => {
    const graphql = octokitGraphql.defaults({
        headers: { authorization: `bearer ${accessToken}` },
    });

    const query = `
mutation($subjectId: ID!) {
  unminimizeComment(input: { subjectId: $subjectId }) {
    unminimizedComment {
      ... on PullRequestReview {
        databaseId
        isMinimized
        minimizedReason
      }
    }
  }
}`;

    await graphql<{
        unminimizeComment: {
            unminimizedComment: {
                databaseId: number;
                isMinimized: boolean;
                minimizedReason: string | null;
            } | null;
        };
    }>(query, { subjectId });
};

// TODO: Check if generators support cache() or maybe internally we can cache?
export async function* getPullRequestFilesStream(
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    commitSha?: string,
    userId?: string,
    signal?: AbortSignal,
): AsyncGenerator<PullRequestFile[], void, undefined> {
    if (commitSha) {
        const commit = userId
            ? await getCachedCommit(accessToken, owner, repo, commitSha, userId)
            : await getCommit(accessToken, owner, repo, commitSha);
        yield commit.files ?? [];
    } else {
        const octokit = createOctokit(accessToken);
        for await (const page of octokit.paginate.iterator(
            octokit.pulls.listFiles,
            {
                owner,
                repo,
                pull_number: pullNumber,
                per_page: 30,
                ...(signal ? { request: { signal } } : {}),
            },
        )) {
            yield page.data;
        }
    }
}

export const getGitHubUser = cache(
    async (accessToken: string, username: string) => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.users.getByUsername({ username });
        return response.data;
    },
);

export const getGitHubTeam = cache(
    async (accessToken: string, org: string, teamSlug: string) => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.teams.getByName({
            org,
            team_slug: teamSlug,
        });
        return response.data;
    },
);

export const getRepo = cache(
    async (accessToken: string, owner: string, repo: string) => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.rest.repos.get({ owner, repo });
        return response.data;
    },
);

export async function getCachedRepo(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<RestEndpointMethodTypes["repos"]["get"]["response"]["data"]> {
    return getCachedRepoData({
        provider: "github",
        owner,
        repo,
        staleAfterMs: 5 * 60 * 1000,
        fetcher: async () => {
            try {
                return await getRepo(accessToken, owner, repo);
            } catch (error) {
                // A missing repo surfaces as a 404 from the REST client; any
                // other failure (rate limit, outage) must propagate as-is.
                if ((error as { status?: number }).status === 404) return null;
                throw error;
            }
        },
        toRepo: (payload) => githubRepoToSyncRepo(payload),
    });
}

const getRepoIssuePullCounts = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
    ): Promise<{
        openIssuesCount: number;
        openPullRequestsCount: number;
    } | null> => {
        const graphql = octokitGraphql.defaults({
            headers: { authorization: `bearer ${accessToken}` },
        });

        const query = `
query GetRepoIssuePullCounts($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    issues(states: OPEN) {
      totalCount
    }
    pullRequests(states: OPEN) {
      totalCount
    }
  }
}`;
        const result = await graphql<{
            repository?: {
                issues: {
                    totalCount: number;
                };
                pullRequests: {
                    totalCount: number;
                };
            };
        }>(query, {
            owner,
            repo,
        });

        if (!result?.repository) {
            return null;
        }

        return {
            openIssuesCount: result.repository.issues.totalCount,
            openPullRequestsCount: result.repository.pullRequests.totalCount,
        };
    },
);

export async function getCachedRepoIssuePullCounts(
    accessToken: string,
    userId: string,
    owner: string,
    repo: string,
): Promise<{ openIssuesCount: number; openPullRequestsCount: number } | null> {
    return withStaleWhileRevalidate(
        repoIssuePullCountsCacheKey("gh", userId, owner, repo),
        () => getRepoIssuePullCounts(accessToken, owner, repo),
        { staleAfter: 3_000, deleteAfter: 24 * 60 * 60 * 1000 },
    );
}

export interface RepoHeaderInfo {
    hasIssues: boolean;
    hasWiki: boolean;
    hasProjects: boolean;
    hasDiscussions: boolean;
    isPrivate: boolean;
    permissions: { admin: boolean };
    ownerAvatarUrl: string | null;
}

export async function getCachedRepoHeaderData(
    accessToken: string,
    username: string | null,
    owner: string,
    repo: string,
): Promise<RepoHeaderInfo | null> {
    const [repoInfo, permission] = await Promise.all([
        getCachedRepo(accessToken, owner, repo),
        getRepoPermissionForUser("github", username, owner, repo),
    ]);

    const access = viewerRepoAccess({
        username,
        payload: repoInfo,
        permission,
    });
    // The cached payload is shared across users; a viewer without a grant
    // must not see a private repo through it. Callers decide how to surface
    // the denial (this is resolved into a promise the header consumes, so a
    // server notFound() here could never produce a 404).
    if (!access.canView) return null;

    return {
        hasIssues: repoInfo.has_issues,
        hasWiki: repoInfo.has_wiki,
        hasProjects: repoInfo.has_projects,
        hasDiscussions: repoInfo.has_discussions,
        isPrivate: repoInfo.private,
        permissions: { admin: access.admin },
        ownerAvatarUrl: repoInfo.owner.avatar_url,
    };
}

export async function getCachedRepoLanguages(
    accessToken: string,
    userId: string,
    owner: string,
    repo: string,
): Promise<Record<string, number>> {
    return withStaleWhileRevalidate(
        repoLanguagesCacheKey(userId, owner, repo),
        () => getRepoLanguages(accessToken, owner, repo),
        { staleAfter: 5 * 60 * 1000, deleteAfter: 7 * 24 * 60 * 60 * 1000 },
    );
}

export async function getCachedRepoContributors(
    accessToken: string,
    userId: string,
    owner: string,
    repo: string,
): Promise<RepoContributor[]> {
    return withStaleWhileRevalidate(
        repoContributorsCacheKey(userId, owner, repo),
        () => getRepoContributors(accessToken, owner, repo),
        { staleAfter: 5 * 60 * 1000, deleteAfter: 7 * 24 * 60 * 60 * 1000 },
    );
}

export async function getCachedRepoDocFileNames(
    accessToken: string,
    userId: string,
    owner: string,
    repo: string,
    ref?: string,
): Promise<RepoDocFileName[]> {
    return withStaleWhileRevalidate(
        repoDocFilesCacheKey(userId, owner, repo, ref),
        () => getRepoDocFileNames(accessToken, owner, repo, ref),
        { staleAfter: 5 * 60 * 1000, deleteAfter: 7 * 24 * 60 * 60 * 1000 },
    );
}

export async function getCachedRepoStarred(
    accessToken: string,
    owner: string,
    repo: string,
    userId: string,
): Promise<boolean> {
    return withStaleWhileRevalidate(
        repoStarredCacheKey("gh", userId, owner, repo),
        () => checkRepoStarred(accessToken, owner, repo),
        { staleAfter: 30_000, deleteAfter: 24 * 60 * 60 * 1000 },
    );
}

export async function getCachedRepoSubscription(
    accessToken: string,
    owner: string,
    repo: string,
    userId: string,
): Promise<RepoSubscription | null> {
    return withStaleWhileRevalidate(
        repoSubscriptionCacheKey("gh", userId, owner, repo),
        () => getRepoSubscription(accessToken, owner, repo),
        { staleAfter: 30_000, deleteAfter: 24 * 60 * 60 * 1000 },
    );
}

export type Milestone = NonNullable<PullsGetResponseData["milestone"]>;

export const listMilestonesForRepo = async (
    accessToken: string,
    owner: string,
    repo: string,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.issues.listMilestones({
        owner,
        repo,
        state: "open",
        per_page: 100,
    });
    return response.data;
};

export const updateIssueMilestone = async (
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
    milestone: number | null,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        milestone,
    });
    return response.data;
};

export const getIssue = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        issueNumber: number,
    ) => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.issues.get({
            owner,
            repo,
            issue_number: issueNumber,
        });
        return response.data;
    },
);

export type IssueGetResponseData =
    RestEndpointMethodTypes["issues"]["get"]["response"]["data"];

export const listLabelsForRepo = async (
    accessToken: string,
    owner: string,
    repo: string,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.issues.listLabelsForRepo({
        owner,
        repo,
    });
    return response.data;
};

export const addLabelsToIssue = async (
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
    labels: string[],
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.issues.addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels,
    });
    return response.data;
};

export const removeLabelFromIssue = async (
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
    labelName: string,
) => {
    const octokit = createOctokit(accessToken);
    await octokit.issues.removeLabel({
        owner,
        repo,
        issue_number: issueNumber,
        name: labelName,
    });
};

export const listRepoAssignees = async (
    accessToken: string,
    owner: string,
    repo: string,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.issues.listAssignees({
        owner,
        repo,
        per_page: 100,
    });
    return response.data;
};

export const addAssigneesToIssue = async (
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
    assignees: string[],
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.issues.addAssignees({
        owner,
        repo,
        issue_number: issueNumber,
        assignees,
    });
    return response.data;
};

export const removeAssigneesFromIssue = async (
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number,
    assignees: string[],
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.issues.removeAssignees({
        owner,
        repo,
        issue_number: issueNumber,
        assignees,
    });
    return response.data;
};

export const listRecentIssueAuthors = async (
    accessToken: string,
    owner: string,
    repo: string,
) => {
    const graphql = octokitGraphql.defaults({
        headers: { authorization: `bearer ${accessToken}` },
    });

    // REST listForRepo returns both issues and pull requests, so the query
    // unions both connections to preserve that behavior.
    const query = `
query RecentIssueAuthors($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    issues(first: 100, orderBy: { field: CREATED_AT, direction: DESC }) {
      nodes {
        author {
          login
          avatarUrl
        }
      }
    }
    pullRequests(first: 100, orderBy: { field: CREATED_AT, direction: DESC }) {
      nodes {
        author {
          login
          avatarUrl
        }
      }
    }
  }
}`;

    try {
        const result = await graphql<{
            repository?: {
                issues: {
                    nodes: Array<{
                        author: { login: string; avatarUrl: string } | null;
                    } | null>;
                };
                pullRequests: {
                    nodes: Array<{
                        author: { login: string; avatarUrl: string } | null;
                    } | null>;
                };
            } | null;
        }>(query, { owner, repo });

        const seen = new Set<string>();
        const authors: Array<{
            login: string;
            avatar_url: string | null;
        }> = [];
        const nodes = [
            ...(result.repository?.issues?.nodes ?? []),
            ...(result.repository?.pullRequests?.nodes ?? []),
        ];
        for (const node of nodes) {
            if (!node?.author) continue;
            if (seen.has(node.author.login)) continue;
            seen.add(node.author.login);
            authors.push({
                login: node.author.login,
                avatar_url: node.author.avatarUrl,
            });
        }
        return authors;
    } catch (error) {
        if (!isOrgRestrictionError(error)) throw error;
        return listRecentIssueAuthorsRest(accessToken, owner, repo);
    }
};

/**
 * REST fallback for listRecentIssueAuthors. issues.listForRepo returns both
 * issues and pull requests, matching the graphql query's union.
 */
async function listRecentIssueAuthorsRest(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<Array<{ login: string; avatar_url: string | null }>> {
    const octokit = createOctokit(accessToken);
    const response = await octokit.issues.listForRepo({
        owner,
        repo,
        state: "all",
        sort: "created",
        direction: "desc",
        per_page: 100,
    });

    const seen = new Set<string>();
    const authors: Array<{ login: string; avatar_url: string | null }> = [];
    for (const issue of response.data) {
        if (issue.user && !seen.has(issue.user.login)) {
            seen.add(issue.user.login);
            authors.push({
                login: issue.user.login,
                avatar_url: issue.user.avatar_url ?? null,
            });
        }
    }
    return authors;
}

export const addReviewersToPullRequest = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    reviewers: string[],
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.pulls.requestReviewers({
        owner,
        repo,
        pull_number: pullNumber,
        reviewers,
    });
    return response.data;
};

export const removeReviewersFromPullRequest = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    reviewers: string[],
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.pulls.removeRequestedReviewers({
        owner,
        repo,
        pull_number: pullNumber,
        reviewers,
    });
    return response.data;
};

type RawReviewThreadComment = {
    databaseId: number;
    body: string;
    author: GQLActor | null;
    createdAt: string;
    replyTo: { databaseId: number } | null;
};

type RawReviewThreadNode = {
    id: string;
    isResolved: boolean;
    isOutdated: boolean;
    path: string | null;
    comments: { nodes: (RawReviewThreadComment | null)[] };
};

export type ReviewThreadData = {
    id: string;
    isResolved: boolean;
    isOutdated: boolean;
    path: string | null;
    pullRequestId: string;
    comments: Array<{
        id: number;
        body: string;
        author: {
            login: string;
            avatarUrl: string;
            url: string;
        } | null;
        createdAt: string;
        replyToId: number | null;
    }>;
};

type RawReviewThreadSummaryComment = {
    databaseId: number;
    body: string;
    author: GQLActor | null;
};

type RawReviewThreadSummaryNode = {
    id: string;
    isResolved: boolean;
    isOutdated: boolean;
    path: string | null;
    comments: {
        totalCount: number;
        nodes: (RawReviewThreadSummaryComment | null)[];
    };
};

export type ReviewThreadSummary = {
    id: string;
    isResolved: boolean;
    isOutdated: boolean;
    path: string | null;
    commentCount: number;
    root: {
        id: number;
        body: string;
        author: {
            login: string;
            avatarUrl: string;
        } | null;
    } | null;
};

export const getReviewThreads = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
): Promise<ReviewThreadData[]> => {
    const graphql = octokitGraphql.defaults({
        headers: { authorization: `bearer ${accessToken}` },
    });

    const query = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      id
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          isOutdated
          path
          comments(first: 100) {
            nodes {
              databaseId
              body
              author {
                login
                avatarUrl
                url
              }
              createdAt
              replyTo {
                databaseId
              }
            }
          }
        }
      }
    }
  }
}`;

    const result = await graphql<{
        repository?: {
            pullRequest?: {
                id: string;
                reviewThreads?: {
                    nodes: (RawReviewThreadNode | null)[];
                };
            } | null;
        } | null;
    }>(query, { owner, repo, number: pullNumber });

    const threadNodes =
        result.repository?.pullRequest?.reviewThreads?.nodes ?? [];

    const pullRequestId = result.repository?.pullRequest?.id ?? "";

    return threadNodes
        .filter((thread): thread is RawReviewThreadNode => thread != null)
        .map((thread) => {
            const comments = (thread.comments?.nodes ?? [])
                .filter((c): c is RawReviewThreadComment => c != null)
                .map((c) => ({
                    id: c.databaseId,
                    body: c.body,
                    author: c.author,
                    createdAt: c.createdAt,
                    replyToId: c.replyTo?.databaseId ?? null,
                }));

            return {
                id: thread.id,
                isResolved: thread.isResolved,
                isOutdated: thread.isOutdated,
                path: thread.path,
                pullRequestId,
                comments,
            };
        });
};

export async function getReviewThreadsPage(
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    perPage = 50,
    after?: string,
): Promise<{
    threads: ReviewThreadSummary[];
    hasNextPage: boolean;
    endCursor: string | null;
}> {
    const afterVar = after ? ", $after: String!" : "";
    const afterArg = after ? ", after: $after" : "";
    const graphql = octokitGraphql.defaults({
        headers: { authorization: `bearer ${accessToken}` },
    });

    const query = `
query($owner: String!, $repo: String!, $number: Int!, $first: Int!${afterVar}) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: $first${afterArg}) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          isResolved
          isOutdated
          path
          comments(first: 1) {
            totalCount
            nodes {
              databaseId
              body
              author {
                login
                avatarUrl
              }
            }
          }
        }
      }
    }
  }
}`;

    const result = await graphql<{
        repository?: {
            pullRequest?: {
                reviewThreads?: {
                    pageInfo: {
                        hasNextPage: boolean;
                        endCursor: string | null;
                    };
                    nodes: (RawReviewThreadSummaryNode | null)[];
                };
            } | null;
        } | null;
    }>(query, {
        owner,
        repo,
        number: pullNumber,
        first: perPage,
        ...(after ? { after } : {}),
    });

    const reviewThreads = result.repository?.pullRequest?.reviewThreads;
    const pageInfo = reviewThreads?.pageInfo ?? {
        hasNextPage: false,
        endCursor: null,
    };
    const threadNodes = reviewThreads?.nodes ?? [];

    const threads = threadNodes
        .filter(
            (thread): thread is RawReviewThreadSummaryNode => thread != null,
        )
        .map((thread) => {
            const rootNode =
                thread.comments?.nodes.find(
                    (c): c is RawReviewThreadSummaryComment => c != null,
                ) ?? null;

            return {
                id: thread.id,
                isResolved: thread.isResolved,
                isOutdated: thread.isOutdated,
                path: thread.path,
                commentCount: thread.comments?.totalCount ?? 0,
                root: rootNode
                    ? {
                          id: rootNode.databaseId,
                          body: rootNode.body,
                          author: rootNode.author
                              ? {
                                    login: rootNode.author.login,
                                    avatarUrl: rootNode.author.avatarUrl,
                                }
                              : null,
                      }
                    : null,
            };
        });

    return {
        threads,
        hasNextPage: pageInfo.hasNextPage ?? false,
        endCursor: pageInfo.endCursor ?? null,
    };
}

export const resolveReviewThread = async (
    accessToken: string,
    threadId: string,
): Promise<void> => {
    const graphql = octokitGraphql.defaults({
        headers: { authorization: `bearer ${accessToken}` },
    });

    const query = `
mutation($threadId: ID!) {
  resolveReviewThread(input: { threadId: $threadId }) {
    thread {
      id
      isResolved
    }
  }
}`;

    await graphql<{
        resolveReviewThread: {
            thread: { id: string; isResolved: boolean };
        };
    }>(query, { threadId });
};

export const unresolveReviewThread = async (
    accessToken: string,
    threadId: string,
): Promise<void> => {
    const graphql = octokitGraphql.defaults({
        headers: { authorization: `bearer ${accessToken}` },
    });

    const query = `
mutation($threadId: ID!) {
  unresolveReviewThread(input: { threadId: $threadId }) {
    thread {
      id
      isResolved
    }
  }
}`;

    await graphql<{
        unresolveReviewThread: {
            thread: { id: string; isResolved: boolean };
        };
    }>(query, { threadId });
};

const getFileContentFromBranch = async (
    accessToken: string,
    owner: string,
    repo: string,
    path: string,
    ref: string,
): Promise<{ content: string; sha: string }> => {
    const octokit = createOctokit(accessToken);
    const { data: fileData } = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref,
    });

    if (Array.isArray(fileData) || !("content" in fileData)) {
        throw new Error(
            "Expected a single file, got a directory or unexpected response",
        );
    }

    return {
        content: Buffer.from(fileData.content, "base64").toString("utf-8"),
        sha: fileData.sha,
    };
};

const detectDominantEol = (content: string): "\n" | "\r\n" => {
    const crlfCount = content.match(/\r\n/g)?.length ?? 0;
    const lfCount = (content.match(/\n/g)?.length ?? 0) - crlfCount;
    return crlfCount > lfCount ? "\r\n" : "\n";
};

/**
 * Resolve the 0-based line range a code suggestion targets and reject ranges
 * that fall outside the file. `line` is the last replaced line and is
 * required; `startLine` is the first replaced line (defaulting to `line`).
 */
const resolveSuggestionRange = (
    line: number | null | undefined,
    startLine: number | null | undefined,
    totalLines: number,
    path?: string,
): { replaceStart: number; replaceEnd: number } => {
    if (line == null) {
        throw new Error(
            `Cannot apply suggestion: line is required${path ? ` for ${path}` : ""} (file has ${totalLines} lines)`,
        );
    }

    const replaceStart = (startLine ?? line) - 1;
    const replaceEnd = line - 1;

    if (
        replaceStart < 0 ||
        replaceEnd < replaceStart ||
        replaceEnd >= totalLines
    ) {
        throw new Error(
            `Line range ${replaceStart + 1}-${replaceEnd + 1} is out of bounds${path ? ` for ${path}` : ""} (${totalLines} lines)`,
        );
    }

    return { replaceStart, replaceEnd };
};

/**
 * Compute the file content that results from applying a GitHub code
 * suggestion without touching the remote. The targeted range follows the same
 * semantics as `getSuggestionPatch` (startLine through line). A single
 * trailing newline on the suggestion is stripped so suggestion blocks — which
 * end with a newline — don't inject an empty line, and unchanged lines keep
 * the file's original line endings.
 */
export const buildSuggestionNewContent = (
    currentContent: string,
    suggestionCode: string,
    line: number | null | undefined,
    startLine: number | null | undefined,
    path?: string,
): string => {
    const allLines = currentContent.split(/\r?\n/);
    const { replaceStart, replaceEnd } = resolveSuggestionRange(
        line,
        startLine,
        allLines.length,
        path,
    );

    const suggestionLines = suggestionCode.replace(/\n$/, "").split("\n");

    return [
        ...allLines.slice(0, replaceStart),
        ...suggestionLines,
        ...allLines.slice(replaceEnd + 1),
    ].join(detectDominantEol(currentContent));
};

export const getSuggestionPatch = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    path: string,
    suggestionCode: string,
    line: number,
    startLine?: number | null,
    contextLines: number = 3,
): Promise<string> => {
    const pr = await getPullRequest(accessToken, owner, repo, pullNumber);
    const headRef = pr.head.ref;

    const { content: currentContent } = await getFileContentFromBranch(
        accessToken,
        owner,
        repo,
        path,
        headRef,
    );

    const allLines = currentContent.split("\n");
    const { replaceStart, replaceEnd } = resolveSuggestionRange(
        line,
        startLine,
        allLines.length,
        path,
    );

    const contextStart = Math.max(0, replaceStart - contextLines);
    const contextEnd = Math.min(allLines.length - 1, replaceEnd + contextLines);

    const patchLines: string[] = [
        ...allLines.slice(contextStart, replaceStart).map((l) => ` ${l}`),
        ...allLines.slice(replaceStart, replaceEnd + 1).map((l) => `-${l}`),
    ];

    const suggestionLines = suggestionCode.replace(/\n$/, "").split("\n");
    for (const l of suggestionLines) {
        patchLines.push(`+${l}`);
    }

    patchLines.push(
        ...allLines.slice(replaceEnd + 1, contextEnd + 1).map((l) => ` ${l}`),
    );

    const contextCount =
        replaceStart - contextStart + (contextEnd - replaceEnd);
    const removedCount = replaceEnd - replaceStart + 1;
    const addedCount = suggestionLines.length;

    const oldStart = contextStart + 1;
    const newStart = contextStart + 1;
    const oldCount = contextCount + removedCount;
    const newCount = contextCount + addedCount;

    return `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@\n${patchLines.join("\n")}`;
};

export const applySuggestion = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    path: string,
    suggestionCode: string,
    line?: number | null,
    startLine?: number | null,
): Promise<void> => {
    const octokit = createOctokit(accessToken);

    const pr = await getPullRequest(accessToken, owner, repo, pullNumber);
    const headRef = pr.head.ref;

    const { content: currentContent, sha: fileSha } =
        await getFileContentFromBranch(accessToken, owner, repo, path, headRef);

    const newContent = buildSuggestionNewContent(
        currentContent,
        suggestionCode,
        line,
        startLine,
        path,
    );

    const base64Content = Buffer.from(newContent, "utf-8").toString("base64");

    await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: `Apply suggestion to ${path}`,
        content: base64Content,
        sha: fileSha,
        branch: headRef,
    });
};

export type RepoListItem = {
    owner: string;
    name: string;
    fullName: string;
    private: boolean;
};

export async function getUserRepos(
    accessToken: string,
): Promise<RepoListItem[]> {
    const graphql = octokitGraphql.defaults({
        headers: { authorization: `bearer ${accessToken}` },
    });

    const query = `
query ViewerRepos($first: Int!, $after: String) {
  viewer {
    repositories(
      first: $first
      after: $after
      ownerAffiliations: OWNER
      orderBy: { field: NAME, direction: ASC }
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        name
        owner {
          login
        }
        isPrivate
      }
    }
  }
}`;

    const results: RepoListItem[] = [];
    let cursor: string | null = null;
    for (;;) {
        const result: {
            viewer: {
                repositories: {
                    pageInfo: {
                        hasNextPage: boolean;
                        endCursor: string | null;
                    };
                    nodes: Array<{
                        name: string;
                        owner: { login: string };
                        isPrivate: boolean;
                    } | null>;
                };
            };
        } = await graphql<{
            viewer: {
                repositories: {
                    pageInfo: {
                        hasNextPage: boolean;
                        endCursor: string | null;
                    };
                    nodes: Array<{
                        name: string;
                        owner: { login: string };
                        isPrivate: boolean;
                    } | null>;
                };
            };
        }>(query, { first: 100, after: cursor });

        for (const r of result.viewer.repositories.nodes) {
            if (!r) continue;
            results.push({
                owner: r.owner.login,
                name: r.name,
                fullName: `${r.owner.login}/${r.name}`,
                private: r.isPrivate,
            });
        }

        if (!result.viewer.repositories.pageInfo.hasNextPage) break;
        cursor = result.viewer.repositories.pageInfo.endCursor;
    }

    return results;
}

export interface RepoContentItem {
    type: "file" | "dir" | "submodule" | "symlink";
    name: string;
    path: string;
    sha: string;
    size: number;
    htmlUrl: string | null;
}

export async function getRepoContents(
    accessToken: string,
    owner: string,
    repo: string,
    path?: string,
    ref?: string,
): Promise<RepoContentItem[]> {
    const octokit = createOctokit(accessToken);
    const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: path ?? "",
        ref,
    });

    if (Array.isArray(data)) {
        return data.map((item) => ({
            type: item.type as RepoContentItem["type"],
            name: item.name,
            path: item.path,
            sha: item.sha,
            size: item.size,
            htmlUrl: item.html_url ?? null,
        }));
    }

    return [
        {
            type: data.type as RepoContentItem["type"],
            name: data.name,
            path: data.path,
            sha: data.sha,
            size: data.size,
            htmlUrl: data.html_url ?? null,
        },
    ];
}

export interface RepoDocFile {
    name: string;
    path: string;
    content: string;
}

export interface RepoDocFileName {
    name: string;
    path: string;
    displayName: string;
}

export const DOC_FILE_PATTERNS = [
    /^readme/i,
    /^contributing\.md$/i,
    /^code_of_conduct\.md$/i,
    /^(licen[cs]e|copying)/i,
];

const PRIORITY_ORDER: Record<string, number> = {
    readme: 0,
    contributing: 1,
    code_of_conduct: 2,
};

export function getDocFileSortKey(name: string): string {
    const base = name.replace(/\.[^.]+$/, "").toLowerCase();
    const priority = PRIORITY_ORDER[base];
    if (priority !== undefined) {
        return String(priority).padStart(3, "0");
    }
    return `zzz${name.toLowerCase()}`;
}

export function getDocFileDisplayName(name: string): string {
    const base = name.replace(/\.[^.]+$/, "");
    const lowerBase = base.toLowerCase();

    if (/^readme/i.test(name)) return "README";
    if (/^contributing/i.test(name)) return "Contributing";
    if (/^code_of_conduct/i.test(name)) return "Code of Conduct";

    if (/mit/i.test(lowerBase)) return "MIT License";
    if (/apache/i.test(lowerBase)) return "Apache-2.0 License";
    if (/gpl/i.test(lowerBase)) return "GPL License";
    if (/bsd/i.test(lowerBase)) return "BSD License";
    if (/mpl/i.test(lowerBase)) return "MPL License";

    return base;
}

export async function getRepoDocFileNames(
    accessToken: string,
    owner: string,
    repo: string,
    ref?: string,
): Promise<RepoDocFileName[]> {
    const octokit = createOctokit(accessToken);

    const { data: rootData } = await octokit.rest.repos.getContent({
        owner,
        repo,
        ref,
        path: "",
    });

    const items = Array.isArray(rootData) ? rootData : [rootData];

    const docItems = items.filter(
        (item) =>
            item.type === "file" &&
            DOC_FILE_PATTERNS.some((p) => p.test(item.name)),
    );

    return docItems
        .map((item) => ({
            name: item.name,
            path: item.path,
            displayName: getDocFileDisplayName(item.name),
        }))
        .sort((a, b) =>
            getDocFileSortKey(a.name).localeCompare(getDocFileSortKey(b.name)),
        );
}

export async function getDocFileContent(
    accessToken: string,
    owner: string,
    repo: string,
    ref: string,
    path: string,
): Promise<{ content: string }> {
    const graphql = octokitGraphql.defaults({
        headers: { authorization: `bearer ${accessToken}` },
    });

    const query = `query GetDocFile($owner: String!, $repo: String!, $expression: String!) {
  repository(owner: $owner, name: $repo) {
    object(expression: $expression) {
      ... on Blob {
        text
      }
    }
  }
}`;

    const result = await graphql<{
        repository?: {
            object?: { text?: string | null } | null;
        };
    }>(query, {
        owner,
        repo,
        expression: `${ref}:${path}`,
    });

    const text = result.repository?.object?.text;
    if (text == null) {
        throw new Error(`File not found: ${path}`);
    }

    return { content: text };
}

export async function getCachedDocFileContent(
    accessToken: string,
    userId: string,
    owner: string,
    repo: string,
    ref: string,
    path: string,
): Promise<{ content: string }> {
    return withStaleWhileRevalidate(
        `doc-file:${userId}:${owner}:${repo}:${ref}:${path}`,
        () => getDocFileContent(accessToken, owner, repo, ref, path),
        {
            staleAfter: 24 * 60 * 60 * 1000,
            deleteAfter: 7 * 24 * 60 * 60 * 1000,
        },
    );
}

export async function getRepoDocFiles(
    accessToken: string,
    owner: string,
    repo: string,
    ref?: string,
): Promise<RepoDocFile[]> {
    const octokit = createOctokit(accessToken);

    const { data: rootData } = await octokit.rest.repos.getContent({
        owner,
        repo,
        ref,
        path: "",
    });

    const items = Array.isArray(rootData) ? rootData : [rootData];

    const docItems = items.filter(
        (item) =>
            item.type === "file" &&
            DOC_FILE_PATTERNS.some((p) => p.test(item.name)),
    );

    const results = await Promise.all(
        docItems.map(async (item) => {
            try {
                const { data: fileData } = await octokit.rest.repos.getContent({
                    owner,
                    repo,
                    path: item.path,
                    ref,
                });

                if (Array.isArray(fileData)) return null;
                if (fileData.type !== "file" || !fileData.content) return null;

                const content = Buffer.from(
                    fileData.content,
                    "base64",
                ).toString("utf-8");
                return {
                    name: fileData.name,
                    path: fileData.path,
                    content,
                };
            } catch {
                return null;
            }
        }),
    );

    return results
        .filter((f): f is RepoDocFile => f !== null)
        .sort((a, b) =>
            getDocFileSortKey(a.name).localeCompare(getDocFileSortKey(b.name)),
        );
}

export async function getRepoLanguages(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<Record<string, number>> {
    const octokit = createOctokit(accessToken);
    const { data } = await octokit.rest.repos.listLanguages({ owner, repo });
    return data;
}

export interface RepoBranch {
    name: string;
    sha: string;
}

export async function getRepoBranches(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<RepoBranch[]> {
    const octokit = createOctokit(accessToken);
    const iterator = octokit.paginate.iterator(
        octokit.rest.repos.listBranches,
        { owner, repo, per_page: 100 },
    );

    const results: RepoBranch[] = [];
    for await (const { data } of iterator) {
        for (const branch of data) {
            results.push({
                name: branch.name,
                sha: branch.commit.sha,
            });
        }
    }
    return results;
}

export interface RepoTag {
    name: string;
    sha: string;
}

export async function getRepoTags(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<RepoTag[]> {
    const octokit = createOctokit(accessToken);
    const iterator = octokit.paginate.iterator(octokit.rest.repos.listTags, {
        owner,
        repo,
        per_page: 100,
    });

    const results: RepoTag[] = [];
    for await (const { data } of iterator) {
        for (const tag of data) {
            results.push({
                name: tag.name,
                sha: tag.commit.sha,
            });
        }
    }
    return results;
}

export interface RepoContributor {
    login: string | null;
    avatarUrl: string | null;
    contributions: number;
}

export async function getRepoContributors(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<RepoContributor[]> {
    const octokit = createOctokit(accessToken);
    const { data } = await octokit.rest.repos.listContributors({
        owner,
        repo,
        per_page: 20,
    });

    return (data ?? []).map((contributor) => ({
        login: contributor.login ?? null,
        avatarUrl: contributor.avatar_url ?? null,
        contributions: contributor.contributions,
    }));
}

export interface RepoDeployment {
    id: string;
    environment: string;
    state: string;
    createdAt: string;
}

export async function getRepoDeployments(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<RepoDeployment[]> {
    const graphql = octokitGraphql.defaults({
        headers: { authorization: `bearer ${accessToken}` },
    });

    const query = `
query RepoDeployments($owner: String!, $repo: String!, $first: Int!) {
  repository(owner: $owner, name: $repo) {
    deployments(first: $first, orderBy: { field: CREATED_AT, direction: DESC }) {
      nodes {
        id
        environment
        createdAt
        latestStatus {
          state
        }
      }
    }
  }
}`;

    try {
        const result = await graphql<{
            repository?: {
                deployments?: {
                    nodes: Array<{
                        id: string;
                        environment: string | null;
                        createdAt: string;
                        latestStatus: { state: string } | null;
                    } | null>;
                } | null;
            } | null;
        }>(query, { owner, repo, first: 100 });

        const deployments = result.repository?.deployments?.nodes ?? [];

        const seen = new Set<string>();
        const results: RepoDeployment[] = [];
        for (const d of deployments) {
            if (!d) continue;
            // Newest first, so the first deployment seen per environment is
            // its latest; latestStatus already carries that deployment's
            // latest state.
            const env = d.environment ?? "";
            if (seen.has(env)) continue;
            seen.add(env);
            results.push({
                id: d.id,
                environment: env,
                state: d.latestStatus?.state.toLowerCase() ?? "inactive",
                createdAt: d.createdAt,
            });
        }

        return results;
    } catch (error) {
        if (!isOrgRestrictionError(error)) throw error;
        return getRepoDeploymentsRest(accessToken, owner, repo);
    }
}

/**
 * REST fallback for getRepoDeployments: one listDeployments call plus one
 * listDeploymentStatuses call per environment for its latest state.
 */
async function getRepoDeploymentsRest(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<RepoDeployment[]> {
    const octokit = createOctokit(accessToken);
    const { data: deployments } = await octokit.rest.repos.listDeployments({
        owner,
        repo,
        per_page: 100,
    });

    if (!deployments || deployments.length === 0) return [];

    const seen = new Set<string>();
    const latestPerEnv: typeof deployments = [];
    for (const d of deployments) {
        const env = d.environment ?? "";
        if (seen.has(env)) continue;
        seen.add(env);
        latestPerEnv.push(d);
    }

    const results = await Promise.all(
        latestPerEnv.map(async (d) => {
            const { data: statuses } =
                await octokit.rest.repos.listDeploymentStatuses({
                    owner,
                    repo,
                    deployment_id: d.id,
                    per_page: 1,
                });
            const latestStatus = statuses[0];
            return {
                id: String(d.id),
                environment: d.environment ?? "",
                state: latestStatus?.state ?? "inactive",
                createdAt: d.created_at,
            };
        }),
    );

    return results;
}

export interface RepoRelease {
    name: string;
    tagName: string;
    createdAt: string;
    htmlUrl: string;
}

export async function getLatestRelease(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<RepoRelease | null> {
    const octokit = createOctokit(accessToken);
    try {
        const { data } = await octokit.rest.repos.getLatestRelease({
            owner,
            repo,
        });
        return {
            name: data.name ?? data.tag_name,
            tagName: data.tag_name,
            createdAt: data.created_at,
            htmlUrl: data.html_url,
        };
    } catch {
        return null;
    }
}

export interface RepoSubscription {
    subscribed: boolean;
    ignored: boolean;
}

export async function checkRepoStarred(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<boolean> {
    const octokit = createOctokit(accessToken);
    try {
        await octokit.rest.activity.checkRepoIsStarredByAuthenticatedUser({
            owner,
            repo,
        });
        return true;
    } catch {
        return false;
    }
}

export async function starRepo(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<void> {
    const octokit = createOctokit(accessToken);
    await octokit.rest.activity.starRepoForAuthenticatedUser({ owner, repo });
}

export async function unstarRepo(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<void> {
    const octokit = createOctokit(accessToken);
    await octokit.rest.activity.unstarRepoForAuthenticatedUser({
        owner,
        repo,
    });
}

export async function getRepoSubscription(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<RepoSubscription | null> {
    const octokit = createOctokit(accessToken);
    try {
        const { data } = await octokit.rest.activity.getRepoSubscription({
            owner,
            repo,
        });
        return {
            subscribed: data.subscribed,
            ignored: data.ignored,
        };
    } catch {
        return null;
    }
}

export async function setRepoSubscription(
    accessToken: string,
    owner: string,
    repo: string,
    subscribed: boolean,
    ignored: boolean,
): Promise<void> {
    const octokit = createOctokit(accessToken);
    if (!subscribed && !ignored) {
        await octokit.rest.activity.deleteRepoSubscription({ owner, repo });
        return;
    }
    await octokit.rest.activity.setRepoSubscription({
        owner,
        repo,
        subscribed,
        ignored,
    });
}

export async function deleteRepoSubscription(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<void> {
    const octokit = createOctokit(accessToken);
    await octokit.rest.activity.deleteRepoSubscription({ owner, repo });
}

export interface RepoRefCounts {
    branchCount: number;
    tagCount: number;
}

export async function getRepoRefCounts(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<RepoRefCounts> {
    const graphql = octokitGraphql.defaults({
        headers: { authorization: `bearer ${accessToken}` },
    });

    const query = `
query RepoRefCounts($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    branches: refs(refPrefix: "refs/heads/") {
      totalCount
    }
    tags: refs(refPrefix: "refs/tags/") {
      totalCount
    }
  }
}`;

    try {
        const result = await graphql<{
            repository?: {
                branches: { totalCount: number };
                tags: { totalCount: number };
            } | null;
        }>(query, { owner, repo });

        if (!result.repository) {
            throw new Error(`Repository not found: ${owner}/${repo}`);
        }

        return {
            branchCount: result.repository.branches.totalCount,
            tagCount: result.repository.tags.totalCount,
        };
    } catch (error) {
        if (!isOrgRestrictionError(error)) throw error;
        return getRepoRefCountsRest(accessToken, owner, repo);
    }
}

/**
 * REST fallback for getRepoRefCounts: listBranches/listTags with per_page=1,
 * deriving the totals from the Link header pagination metadata.
 */
async function getRepoRefCountsRest(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<RepoRefCounts> {
    const octokit = createOctokit(accessToken);
    const [branchRes, tagRes] = await Promise.all([
        octokit.rest.repos.listBranches({ owner, repo, per_page: 1 }),
        octokit.rest.repos.listTags({ owner, repo, per_page: 1 }),
    ]);

    return {
        branchCount: parseRefCountFromLinkHeader(
            branchRes.headers.link,
            branchRes.data.length,
        ),
        tagCount: parseRefCountFromLinkHeader(
            tagRes.headers.link,
            tagRes.data.length,
        ),
    };
}

function parseRefCountFromLinkHeader(
    linkHeader: string | undefined,
    currentCount: number,
): number {
    if (!linkHeader) return currentCount;

    const linkPattern = /<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="(\w+)"/g;
    let maxPage = 1;
    for (const m of linkHeader.matchAll(linkPattern)) {
        const p = Number.parseInt(m[1] ?? "0", 10);
        if (p > maxPage) maxPage = p;
    }

    if (maxPage <= 1) return currentCount;
    return maxPage;
}

export interface RepoLatestCommit {
    sha: string;
    message: string;
    author: {
        login: string;
        avatarUrl: string;
    } | null;
    committedDate: string | null;
    commitCount: number;
}

export async function getRepoLatestCommit(
    accessToken: string,
    owner: string,
    repo: string,
    ref?: string,
): Promise<RepoLatestCommit> {
    const graphql = octokitGraphql.defaults({
        headers: { authorization: `bearer ${accessToken}` },
    });

    const query = `
query RepoLatestCommit($owner: String!, $repo: String!, $expression: String!) {
  repository(owner: $owner, name: $repo) {
    object(expression: $expression) {
      ... on Commit {
        oid
        messageHeadline
        committedDate
        authors(first: 1) {
          nodes {
            name
            email
            avatarUrl
            user {
              __typename
              login
              avatarUrl
              url
            }
          }
        }
        history {
          totalCount
        }
      }
    }
  }
}`;

    try {
        const result = await graphql<{
            repository?: {
                object?: {
                    oid: string;
                    messageHeadline: string;
                    committedDate: string | null;
                    authors: { nodes: (GQLCommitAuthor | null)[] };
                    history: { totalCount: number };
                } | null;
            } | null;
        }>(query, { owner, repo, expression: ref ?? "HEAD" });

        const commit = result.repository?.object ?? null;
        if (!commit) {
            throw new Error(`No commits found for ${owner}/${repo}`);
        }

        // Commit.author is a GitActor (git identity, no GitHub login); resolve
        // the GitHub user the same way the commit list does, synthesizing it
        // from noreply emails when the user connection fails to resolve.
        const author = commit.authors.nodes[0]
            ? resolveCommitAuthor(commit.authors.nodes[0]).user
            : null;

        return {
            sha: commit.oid,
            message: commit.messageHeadline,
            author: author
                ? { login: author.login, avatarUrl: author.avatarUrl }
                : null,
            committedDate: commit.committedDate,
            commitCount: commit.history.totalCount,
        };
    } catch (error) {
        if (!isOrgRestrictionError(error)) throw error;
        return getRepoLatestCommitRest(accessToken, owner, repo, ref);
    }
}

/**
 * REST fallback for getRepoLatestCommit: listCommits with per_page=1,
 * deriving the commit count from the Link header pagination metadata.
 */
async function getRepoLatestCommitRest(
    accessToken: string,
    owner: string,
    repo: string,
    ref?: string,
): Promise<RepoLatestCommit> {
    const octokit = createOctokit(accessToken);
    const response = await octokit.rest.repos.listCommits({
        owner,
        repo,
        sha: ref,
        per_page: 1,
    });

    const commit = response.data[0];
    if (!commit) {
        throw new Error(`No commits found for ${owner}/${repo}`);
    }

    const commitCount = parseRefCountFromLinkHeader(
        response.headers.link,
        response.data.length,
    );

    const message = commit.commit.message.split("\n")[0] ?? "";

    return {
        sha: commit.sha,
        message,
        author: commit.author
            ? {
                  login: commit.author.login,
                  avatarUrl: commit.author.avatar_url,
              }
            : null,
        committedDate:
            commit.commit.committer?.date ?? commit.commit.author?.date ?? null,
        commitCount,
    };
}

export interface ForkComparison {
    aheadBy: number;
    behindBy: number;
}

export async function getForkComparison(
    accessToken: string,
    owner: string,
    repo: string,
    upstreamFullName: string,
    forkBranch: string,
    parentBranch: string,
): Promise<ForkComparison> {
    const octokit = createOctokit(accessToken);

    const [parentOwner] = upstreamFullName.split("/");
    if (!parentOwner) {
        throw new Error(`Invalid upstream full name: ${upstreamFullName}`);
    }

    const comparison = await octokit.request(
        "GET /repos/{owner}/{repo}/compare/{basehead}",
        {
            owner,
            repo,
            basehead: `${parentOwner}:${parentBranch}...${owner}:${forkBranch}`,
        },
    );

    return {
        aheadBy: comparison.data.ahead_by,
        behindBy: comparison.data.behind_by,
    };
}

export async function mergeForkUpstream(
    accessToken: string,
    owner: string,
    repo: string,
    branch: string,
): Promise<{ message: string | null; mergeType: string | null }> {
    const octokit = createOctokit(accessToken);
    const response = await octokit.request(
        "POST /repos/{owner}/{repo}/merge-upstream",
        {
            owner,
            repo,
            branch,
        },
    );

    return {
        message: response.data.message ?? null,
        mergeType: response.data.merge_type ?? null,
    };
}

export interface FileLatestCommit {
    sha: string;
    message: string;
    committedDate: string | null;
}

interface GqlFileCommitNode {
    oid: string;
    messageHeadline: string;
    committedDate: string;
}

const FILE_COMMITS_CHUNK_SIZE = 50;

function buildFileCommitsBatchQuery(paths: string[]): string {
    const aliases = paths.map(
        (path, i) =>
            `    f${i}: history(first: 1, path: ${JSON.stringify(path)}) {\n      nodes {\n        oid\n        messageHeadline\n        committedDate\n      }\n    }`,
    );

    return `query BatchFileCommits($owner: String!, $repo: String!, $qualifiedRef: String!) {
  repository(owner: $owner, name: $repo) {
    ref(qualifiedName: $qualifiedRef) {
      target {
        ... on Commit {
${aliases.join("\n")}
        }
      }
    }
  }
}`;
}

function fileCommitsCacheKey(
    userId: string,
    owner: string,
    repo: string,
    ref: string,
    paths: string[],
): string {
    const sorted = [...paths].sort().join(",");
    const hash = createHash("sha256").update(sorted).digest("hex").slice(0, 16);
    return `file-commits:${userId}:${owner}:${repo}:${ref}:${hash}`;
}

export async function getFileLatestCommits(
    accessToken: string,
    userId: string,
    owner: string,
    repo: string,
    ref: string,
    paths: string[],
): Promise<Record<string, FileLatestCommit | null>> {
    if (paths.length === 0) return {};

    return withStaleWhileRevalidate(
        fileCommitsCacheKey(userId, owner, repo, ref, paths),
        () => fetchFileCommits(accessToken, owner, repo, ref, paths),
        {
            staleAfter: 24 * 60 * 60 * 1000,
            deleteAfter: 7 * 24 * 60 * 60 * 1000,
        },
    );
}

async function fetchFileCommits(
    accessToken: string,
    owner: string,
    repo: string,
    ref: string,
    paths: string[],
): Promise<Record<string, FileLatestCommit | null>> {
    const graphql = octokitGraphql.defaults({
        headers: { authorization: `bearer ${accessToken}` },
    });

    const qualifiedRef = `refs/heads/${ref}`;
    const record: Record<string, FileLatestCommit | null> = {};

    for (let i = 0; i < paths.length; i += FILE_COMMITS_CHUNK_SIZE) {
        const chunk = paths.slice(i, i + FILE_COMMITS_CHUNK_SIZE);
        const query = buildFileCommitsBatchQuery(chunk);

        const result = await graphql<{
            repository?: {
                ref?: {
                    target?: Record<
                        string,
                        { nodes?: GqlFileCommitNode[] } | null
                    > | null;
                };
            };
        }>(query, {
            owner,
            repo,
            qualifiedRef,
        });

        const target = result.repository?.ref?.target ?? null;

        for (let j = 0; j < chunk.length; j++) {
            const path = chunk[j];
            if (!path) continue;
            const alias = `f${j}`;
            const history = target?.[alias] ?? null;
            const node = history?.nodes?.[0];
            if (node) {
                record[path] = {
                    sha: node.oid,
                    message: node.messageHeadline,
                    committedDate: node.committedDate,
                };
            } else {
                record[path] = null;
            }
        }
    }

    return record;
}

export interface CodeSearchResultItem {
    name: string;
    path: string;
    sha: string;
    htmlUrl: string;
    type: "blob" | "tree";
}

export async function getRepoFileTree(
    accessToken: string,
    owner: string,
    repo: string,
    ref: string,
): Promise<CodeSearchResultItem[]> {
    const octokit = createOctokit(accessToken);

    const { data: refData } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${ref}`,
    });

    const { data: commitData } = await octokit.rest.git.getCommit({
        owner,
        repo,
        commit_sha: refData.object.sha,
    });

    const { data: treeData } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: commitData.tree.sha,
        recursive: "true",
    });

    return treeData.tree
        .filter(
            (item): item is typeof item & { path: string; sha: string } =>
                !!item.path &&
                !!item.sha &&
                (item.type === "blob" || item.type === "tree"),
        )
        .map((item) => ({
            name: item.path.split("/").pop() ?? item.path,
            path: item.path,
            sha: item.sha,
            htmlUrl:
                item.type === "tree"
                    ? `https://github.com/${owner}/${repo}/tree/${ref}/${item.path}`
                    : `https://github.com/${owner}/${repo}/blob/${ref}/${item.path}`,
            type: item.type as "blob" | "tree",
        }));
}

type ListInstallationsResponse = Awaited<
    ReturnType<Octokit["apps"]["listInstallationsForAuthenticatedUser"]>
>["data"];
export type Installation = ListInstallationsResponse["installations"][number];

export async function getGitHubAppInstallations(
    accessToken: string,
    slug: string,
): Promise<Installation[]> {
    const octokit = createOctokit(accessToken);
    const { data, status } =
        await octokit.apps.listInstallationsForAuthenticatedUser();

    if (status !== 200) {
        throw Error(`Failed with ${status}`);
    }

    return data.installations.filter(
        (installation) => installation.app_slug === slug,
    );
}
