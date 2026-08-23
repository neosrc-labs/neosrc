import { cache } from "react";
import { createGraphql } from "~/server/github-graphql";
import { createOctokit } from "./client";
import type { CommentForReview, ReviewComment, ReviewComment2 } from "./pulls";

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
    const graphql = createGraphql(accessToken);

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
 * The merge-requirements lookup is best-effort: branch protection and
 * rulesets may be unreadable for reasons that do not indicate a merge is
 * blocked. Treat the following as "no requirements can be read here" instead
 * of a genuine failure:
 *  - 404: the endpoint is not applicable (no rulesets, no branch protection)
 *  - 403 "make this repository public to enable this feature": the feature is
 *    unavailable on the repo's plan (rulesets / branch protection on private
 *    repos require GitHub Pro)
 *  - 403 "Resource not accessible by integration": the GitHub App / OAuth
 *    integration lacks permission to read branch protection (e.g. the
 *    `administration` read permission was not granted). This is an access
 *    limit on the informational lookup only; the real merge call remains the
 *    source of truth and enforces any protection GitHub applies.
 * Any other error (rate limiting, 5xx, network) is left to propagate so it is
 * not silently swallowed.
 */
function isMergeRequirementsUnreadable(error: unknown): boolean {
    if (error === null || typeof error !== "object" || !("status" in error)) {
        return false;
    }
    const status = error.status;
    if (typeof status === "number" && status === 404) {
        return true;
    }
    if (typeof status === "number" && status === 403) {
        if (!("message" in error)) {
            return false;
        }
        const message = error.message;
        if (typeof message === "string") {
            return (
                message.includes(
                    "make this repository public to enable this feature",
                ) || message.includes("Resource not accessible by integration")
            );
        }
    }
    return false;
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
            // (404), the feature is unavailable on the repo's plan (403 on
            // private repos without GitHub Pro), or the integration lacks
            // permission to read it (403 "Resource not accessible by
            // integration"). Any other failure means the requirements could
            // not be determined and must surface rather than defaulting to
            // none.
            if (!isMergeRequirementsUnreadable(error)) {
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
            // Branch protection may simply not be configured (404), be
            // unavailable on the repo's plan (403 on private repos without
            // GitHub Pro), or be unreadable because the integration lacks
            // permission (403 "Resource not accessible by integration"); all
            // mean there are no determinable requirements. Any other failure
            // must surface.
            if (!isMergeRequirementsUnreadable(error)) {
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

    const graphql = createGraphql(accessToken);

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
    const graphql = createGraphql(accessToken);

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
    const graphql = createGraphql(accessToken);

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
