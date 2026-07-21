import { Octokit, type RestEndpointMethodTypes } from "@octokit/rest";
import { notFound } from "next/navigation";
import { cache } from "react";
import {
    prCacheKey,
    readCache,
    withStaleWhileRevalidate,
} from "~/server/cache";
import type { GQLActor } from "~/server/github-graphql";
export type PullsGetResponseData =
    RestEndpointMethodTypes["pulls"]["get"]["response"]["data"];
export type PullsListCommitsResponseData =
    RestEndpointMethodTypes["pulls"]["listCommits"]["response"]["data"];
export type CommitData =
    RestEndpointMethodTypes["repos"]["getCommit"]["response"]["data"];
export type Label = NonNullable<PullsGetResponseData["labels"]>[number];
export type Reviewer = NonNullable<
    PullsGetResponseData["requested_reviewers"]
>[number];
export type Assignee = NonNullable<PullsGetResponseData["assignees"]>[number];
export type ReviewComment =
    RestEndpointMethodTypes["pulls"]["listReviewComments"]["response"]["data"][number];
export type PullRequestFile =
    RestEndpointMethodTypes["pulls"]["listFiles"]["response"]["data"][number];
export type TeamGetByNameResponseData =
    RestEndpointMethodTypes["teams"]["getByName"]["response"]["data"];
export type GhCheckRuns =
    RestEndpointMethodTypes["checks"]["listForRef"]["response"]["data"];
export type GhCheckRun = GhCheckRuns["check_runs"][number];

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

export function createOctokit(accessToken: string) {
    return new Octokit({
        auth: accessToken,
    });
}

export const getPullRequest = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        pullNumber: number,
    ) => {
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

export const getPullRequestCommits = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        pullNumber: number,
    ) => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.pulls.listCommits({
            owner,
            repo,
            pull_number: pullNumber,
        });
        return response.data;
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
    const response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query: `
				mutation($pullRequestId: ID!) {
					convertPullRequestToDraft(input: { pullRequestId: $pullRequestId }) {
						pullRequest {
							id
							isDraft
						}
					}
				}
			`,
            variables: { pullRequestId: pr.node_id },
        }),
    });

    const result = await response.json();
    if (result.errors) {
        throw new Error(
            `Failed to convert PR to draft: ${result.errors.map((e: { message: string }) => e.message).join(", ")}`,
        );
    }

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

    const response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query: `
				mutation($pullRequestId: ID!) {
					markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
						pullRequest {
							id
							isDraft
						}
					}
				}
			`,
            variables: { pullRequestId: pr.node_id },
        }),
    });

    const result = await response.json();
    if (result.errors) {
        throw new Error(
            `Failed to mark PR as ready: ${result.errors.map((e: { message: string }) => e.message).join(", ")}`,
        );
    }

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

    const response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query: `
				mutation($input: RevertPullRequestInput!) {
					revertPullRequest(input: $input) {
						revertPullRequest {
							number
							url
						}
					}
				}
			`,
            variables: {
                input: {
                    pullRequestId: pr.node_id,
                    title: title ?? undefined,
                    body: body ?? undefined,
                    draft: draft ?? undefined,
                },
            },
        }),
    });

    const result = await response.json();
    if (result.errors) {
        throw new Error(
            `Failed to revert pull request: ${result.errors.map((e: { message: string }) => e.message).join(", ")}`,
        );
    }

    const revertPr = result.data?.revertPullRequest?.revertPullRequest;
    if (!revertPr) {
        throw new Error("Failed to revert pull request: no revert PR returned");
    }

    return {
        number: revertPr.number as number,
        url: revertPr.url as string,
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

export const updateReviewComment = async (
    accessToken: string,
    owner: string,
    repo: string,
    commentId: number,
    body: string,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.pulls.updateReviewComment({
        owner,
        repo,
        comment_id: commentId,
        body,
    });
    return response.data;
};

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

export const getPullRequestReviews = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        pullNumber: number,
    ) => {
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

export const getCheckRuns = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        commitSha: string,
    ): Promise<GhCheckRuns> => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.checks.listForRef({
            owner,
            repo,
            ref: commitSha,
        });
        return response.data;
    },
);

export const getCommitStatuses = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        commitSha: string,
    ) => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.repos.listCommitStatusesForRef({
            owner,
            repo,
            ref: commitSha,
        });
        return response.data;
    },
);

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

export const getPullRequestReactionsPage = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        pullNumber: number,
        page: number = 1,
        perPage: number = 100,
    ) => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.rest.reactions.listForIssue({
            owner,
            repo,
            issue_number: pullNumber,
            per_page: perPage,
            page,
        });
        return response.data;
    },
);

export const getIssueReactionCounts = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        issueNumber: number,
    ) => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.rest.issues.get({
            owner,
            repo,
            issue_number: issueNumber,
        });
        return response.data.reactions ?? null;
    },
);

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
                const response =
                    await octokit.rest.repos.getCollaboratorPermissionLevel({
                        owner,
                        repo,
                        username,
                    });
                return response.data.permission as
                    | "admin"
                    | "write"
                    | "read"
                    | "none";
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
        const response = await octokit.pulls.listReviewComments({
            owner,
            repo,
            pull_number: pullNumber,
            per_page: 100,
        });
        return response.data;
    },
);

export const getPullRequestReviewCommentsForReview = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    reviewId: number,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.pulls.listCommentsForReview({
        owner,
        repo,
        pull_number: pullNumber,
        review_id: reviewId,
        per_page: 100,
    });
    return response.data;
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

    const response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query: `
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
				}
			`,
            variables,
        }),
    });

    const result = await response.json();
    if (result.errors) {
        throw new Error(
            `Failed to create review comment: ${result.errors.map((e: { message: string }) => e.message).join(", ")}`,
        );
    }

    const comment =
        result.data.addPullRequestReviewThread.thread.comments.nodes[0];
    return { id: comment.databaseId as number };
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
    const response = await octokit.pulls.createReviewComment({
        owner,
        repo,
        pull_number: pullNumber,
        body,
        in_reply_to: inReplyTo,
        // biome-ignore lint/suspicious/noExplicitAny: Octokit type requires commit_id/path even for replies, but API only needs in_reply_to
    } as any);
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

// TODO: Check if generators support cache() or maybe internally we can cache?
export async function* getPullRequestFilesStream(
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    commitSha?: string,
    userId?: string,
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
            { owner, repo, pull_number: pullNumber, per_page: 30 },
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

const getRepoIssuePullCounts = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
    ): Promise<{ openIssuesCount: number; openPullRequestsCount: number }> => {
        const octokit = createOctokit(accessToken);
        const [issuesRes, prsRes] = await Promise.all([
            octokit.search.issuesAndPullRequests({
                q: `repo:${owner}/${repo} type:issue state:open`,
                per_page: 1,
            }),
            octokit.search.issuesAndPullRequests({
                q: `repo:${owner}/${repo} type:pr state:open`,
                per_page: 1,
            }),
        ]);
        return {
            openIssuesCount: issuesRes.data.total_count,
            openPullRequestsCount: prsRes.data.total_count,
        };
    },
);

export async function getCachedRepoIssuePullCounts(
    accessToken: string,
    owner: string,
    repo: string,
): Promise<{ openIssuesCount: number; openPullRequestsCount: number }> {
    return withStaleWhileRevalidate(
        `gh:counts:${owner}:${repo}`,
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
    owner: string,
    repo: string,
): Promise<RepoHeaderInfo> {
    return withStaleWhileRevalidate(
        `gh:repo-header:${owner}:${repo}`,
        async () => {
            const repoInfo = await getRepo(accessToken, owner, repo);
            return {
                hasIssues: repoInfo.has_issues,
                hasWiki: repoInfo.has_wiki,
                hasProjects: repoInfo.has_projects,
                hasDiscussions: repoInfo.has_discussions,
                isPrivate: repoInfo.private,
                permissions: { admin: repoInfo.permissions?.admin ?? false },
                ownerAvatarUrl: repoInfo.owner.avatar_url,
            };
        },
        { staleAfter: 5 * 60 * 1000, deleteAfter: 24 * 60 * 60 * 1000 },
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
    const authors: Array<{ login: string; avatar_url: string }> = [];
    for (const issue of response.data) {
        if (issue.user && !seen.has(issue.user.login)) {
            seen.add(issue.user.login);
            authors.push({
                login: issue.user.login,
                avatar_url: issue.user.avatar_url ?? "",
            });
        }
    }
    return authors;
};

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

export const getReviewThreads = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
): Promise<ReviewThreadData[]> => {
    const response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query: `
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
                }
            `,
            variables: {
                owner,
                repo,
                number: pullNumber,
            },
        }),
    });

    const result = await response.json();
    if (result.errors) {
        throw new Error(
            `Failed to fetch review threads: ${result.errors.map((e: { message: string }) => e.message).join(", ")}`,
        );
    }

    const threadNodes =
        result.data?.repository?.pullRequest?.reviewThreads?.nodes ?? [];

    const pullRequestId = result.data?.repository?.pullRequest?.id ?? "";

    return threadNodes
        .filter((thread: unknown) => thread != null)
        .map((thread: RawReviewThreadNode) => {
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
    threads: ReviewThreadData[];
    hasNextPage: boolean;
    endCursor: string | null;
}> {
    const afterVar = after ? ", $after: String!" : "";
    const afterArg = after ? ", after: $after" : "";
    const response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query: `
                query($owner: String!, $repo: String!, $number: Int!, $first: Int!${afterVar}) {
                    repository(owner: $owner, name: $repo) {
                        pullRequest(number: $number) {
                            id
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
                }
            `,
            variables: {
                owner,
                repo,
                number: pullNumber,
                first: perPage,
                ...(after ? { after } : {}),
            },
        }),
    });

    const result = await response.json();
    if (result.errors) {
        throw new Error(
            `Failed to fetch review threads: ${result.errors.map((e: { message: string }) => e.message).join(", ")}`,
        );
    }

    const reviewThreads = result.data?.repository?.pullRequest?.reviewThreads;
    const pageInfo = reviewThreads?.pageInfo ?? {
        hasNextPage: false,
        endCursor: null,
    };
    const threadNodes = reviewThreads?.nodes ?? [];
    const pullRequestId = result.data?.repository?.pullRequest?.id ?? "";

    const threads = threadNodes
        .filter((thread: unknown) => thread != null)
        .map((thread: RawReviewThreadNode) => {
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
    const response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query: `
                mutation($threadId: ID!) {
                    resolveReviewThread(input: { threadId: $threadId }) {
                        thread {
                            id
                            isResolved
                        }
                    }
                }
            `,
            variables: { threadId },
        }),
    });

    const result = await response.json();
    if (result.errors) {
        throw new Error(
            `Failed to resolve review thread: ${result.errors.map((e: { message: string }) => e.message).join(", ")}`,
        );
    }
};

export const unresolveReviewThread = async (
    accessToken: string,
    threadId: string,
): Promise<void> => {
    const response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query: `
                mutation($threadId: ID!) {
                    unresolveReviewThread(input: { threadId: $threadId }) {
                        thread {
                            id
                            isResolved
                        }
                    }
                }
            `,
            variables: { threadId },
        }),
    });

    const result = await response.json();
    if (result.errors) {
        throw new Error(
            `Failed to unresolve review thread: ${result.errors.map((e: { message: string }) => e.message).join(", ")}`,
        );
    }
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
    const replaceStart = (startLine ?? line) - 1;
    const replaceEnd = line - 1;

    const contextStart = Math.max(0, replaceStart - contextLines);
    const contextEnd = Math.min(allLines.length - 1, replaceEnd + contextLines);

    const patchLines: string[] = [];

    for (let i = contextStart; i < replaceStart; i++) {
        patchLines.push(` ${allLines[i] as string}`);
    }

    for (let i = replaceStart; i <= replaceEnd; i++) {
        patchLines.push(`-${allLines[i] as string}`);
    }

    const suggestionLines = suggestionCode.replace(/\n$/, "").split("\n");
    for (const l of suggestionLines) {
        patchLines.push(`+${l}`);
    }

    for (let i = replaceEnd + 1; i <= contextEnd; i++) {
        patchLines.push(` ${allLines[i] as string}`);
    }

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

    const lines = currentContent.split("\n");
    const startIdx = (startLine ?? line ?? 1) - 1;
    const endIdx = (line ?? startLine ?? 1) - 1;
    const suggestionLines = suggestionCode.split("\n");

    const before = lines.slice(0, startIdx);
    const after = lines.slice(endIdx + 1);
    const newContent = [...before, ...suggestionLines, ...after].join("\n");

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
    const octokit = createOctokit(accessToken);
    const iterator = octokit.paginate.iterator(
        octokit.rest.repos.listForAuthenticatedUser,
        {
            per_page: 100,
            sort: "full_name",
            type: "owner",
        },
    );
    const results: RepoListItem[] = [];
    for await (const { data } of iterator) {
        for (const r of data) {
            results.push({
                owner: r.owner.login,
                name: r.name,
                fullName: r.full_name,
                private: r.private,
            });
        }
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

const DOC_FILE_PATTERNS = [
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

function getDocFileSortKey(name: string): string {
    const base = name.replace(/\.[^.]+$/, "").toLowerCase();
    const priority = PRIORITY_ORDER[base];
    if (priority !== undefined) {
        return String(priority).padStart(3, "0");
    }
    return `zzz${name.toLowerCase()}`;
}

function getDocFileDisplayName(name: string): string {
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
    login: string;
    avatarUrl: string;
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
        login: contributor.login ?? "",
        avatarUrl: contributor.avatar_url ?? "",
        contributions: contributor.contributions,
    }));
}

export interface RepoDeployment {
    id: number;
    environment: string;
    state: string;
    createdAt: string;
}

export async function getRepoDeployments(
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
                id: d.id,
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
    committedDate: string;
    commitCount: number;
}

export async function getRepoLatestCommit(
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
            commit.commit.committer?.date ?? commit.commit.author?.date ?? "",
        commitCount,
    };
}

export interface FileLatestCommit {
    sha: string;
    message: string;
    committedDate: string;
}

export async function getFileLatestCommits(
    accessToken: string,
    owner: string,
    repo: string,
    ref: string,
    paths: string[],
): Promise<Record<string, FileLatestCommit | null>> {
    const octokit = createOctokit(accessToken);

    const results = await Promise.all(
        paths.map(async (path) => {
            try {
                const response = await octokit.rest.repos.listCommits({
                    owner,
                    repo,
                    sha: ref,
                    path,
                    per_page: 1,
                });
                const commit = response.data[0];
                if (!commit) return { path, data: null };
                const message = commit.commit.message.split("\n")[0] ?? "";
                return {
                    path,
                    data: {
                        sha: commit.sha,
                        message,
                        committedDate:
                            commit.commit.committer?.date ??
                            commit.commit.author?.date ??
                            "",
                    },
                };
            } catch {
                return { path, data: null };
            }
        }),
    );

    const record: Record<string, FileLatestCommit | null> = {};
    for (const { path, data } of results) {
        record[path] = data;
    }
    return record;
}
