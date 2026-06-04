import { Octokit, type RestEndpointMethodTypes } from "@octokit/rest";
import { cache } from "react";
import { withStaleWhileRevalidate } from "~/server/cache";
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
export type Commit = PullsListCommitsResponseData[number];
export type TimelineEventData =
    RestEndpointMethodTypes["issues"]["listEventsForTimeline"]["response"]["data"][number];
export type IssueCommentData =
    RestEndpointMethodTypes["issues"]["createComment"]["response"]["data"];
export type PullRequestReviewData =
    RestEndpointMethodTypes["pulls"]["createReview"]["response"]["data"];
export type ReviewComment =
    RestEndpointMethodTypes["pulls"]["listReviewComments"]["response"]["data"][number];
export type ReviewCommentsForReviewData =
    RestEndpointMethodTypes["pulls"]["listCommentsForReview"]["response"]["data"];
export type PullRequestReview =
    RestEndpointMethodTypes["pulls"]["listReviews"]["response"]["data"][number];
export type PullRequestFile =
    RestEndpointMethodTypes["pulls"]["listFiles"]["response"]["data"][number];

export function createOctokit(accessToken: string) {
    return new Octokit({
        auth: accessToken,
    });
}

export type UsersGetByUsernameResponseData =
    RestEndpointMethodTypes["users"]["getByUsername"]["response"]["data"];

export type TeamGetByNameResponseData =
    RestEndpointMethodTypes["teams"]["getByName"]["response"]["data"];

export type CheckRun = {
    name: string;
    conclusion: string | null;
    status: string;
    html_url?: string;
    details_url?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    app?: {
        name: string;
        icon?: string | null;
    } | null;
};

export type { Octokit };

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

export const getPullRequestFiles = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        pullNumber: number,
    ) => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.pulls.listFiles({
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
    body: string,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.pulls.update({
        owner,
        repo,
        pull_number: pullNumber,
        body,
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

export const closePullRequest = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.pulls.update({
        owner,
        repo,
        pull_number: pullNumber,
        state: "closed",
    });
    return response.data;
};

export const reopenPullRequest = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.pulls.update({
        owner,
        repo,
        pull_number: pullNumber,
        state: "open",
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
        const response = await octokit.pulls.listReviews({
            owner,
            repo,
            pull_number: pullNumber,
            per_page: 100,
        });
        return response.data;
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
    ) => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.request(
            "GET /repos/{owner}/{repo}/commits/{commit_sha}/check-runs",
            {
                owner,
                repo,
                commit_sha: commitSha,
            },
        );
        return response.data;
    },
);

export const getCommitFiles = cache(
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
        return response.data.files || [];
    },
);

export const getCommit = cache(
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

export const getPullRequestReactions = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        pullNumber: number,
    ) => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.rest.reactions.listForIssue({
            owner,
            repo,
            issue_number: pullNumber,
        });
        return response.data;
    },
);

export const getIssueCommentReactions = async (
    accessToken: string,
    owner: string,
    repo: string,
    commentId: number,
) => {
    const octokit = createOctokit(accessToken);
    const response = await octokit.rest.reactions.listForIssueComment({
        owner,
        repo,
        comment_id: commentId,
    });
    return response.data;
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
    const response =
        await octokit.rest.reactions.listForPullRequestReviewComment({
            owner,
            repo,
            comment_id: commentId,
        });
    return response.data;
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
    ) => {
        return withStaleWhileRevalidate(
            `permission:${owner}:${repo}:${username}`,
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

export const getPullRequestTimeline = cache(
    async (
        accessToken: string,
        owner: string,
        repo: string,
        pullNumber: number,
        page: number = 1,
        perPage: number = 30,
    ) => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.request(
            "GET /repos/{owner}/{repo}/issues/{issue_number}/timeline",
            {
                owner,
                repo,
                issue_number: pullNumber,
                page,
                per_page: perPage,
                mediaType: {
                    previews: ["mockingbird"],
                },
            },
        );
        const linkHeader = response.headers.link;
        const hasMore = linkHeader?.includes('rel="next"') ?? false;
        return {
            events: response.data as TimelineEventData[],
            hasMore,
            nextPage: page + 1,
        };
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
) => {
    // NOTE: Okay, I am really sad about this, but it seems that REST API just does not support adding comments to unsubmitted reviews...
    // https://docs.github.com/en/graphql/reference/mutations#addpullrequestreviewthread
    const response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query: `
				mutation($pullRequestId: ID!, $pullRequestReviewId: ID, $body: String!, $path: String!, $line: Int!, $side: DiffSide!) {
					addPullRequestReviewThread(input: { pullRequestId: $pullRequestId, pullRequestReviewId: $pullRequestReviewId, body: $body, path: $path, line: $line, side: $side }) {
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
            variables: {
                pullRequestId: pullRequestNodeId,
                pullRequestReviewId: pullRequestReviewNodeId,
                body,
                path,
                line,
                side,
            },
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

// TODO: Check if generators support cache() or maybe interally we can cache?
export async function* getPullRequestFilesStream(
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    commitSha?: string,
): AsyncGenerator<PullRequestFile[], void, undefined> {
    if (commitSha) {
        // Fetch files changed in a specific commit.
        // getCommit returns all files in one response (no pagination), so we
        // yield a single page to keep the shape consistent with the PR path.
        const { files } = await getCommit(accessToken, owner, repo, commitSha);
        yield files ?? [];
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

export type RepoGetResponseData =
    RestEndpointMethodTypes["repos"]["get"]["response"]["data"];

export const getRepo = cache(
    async (accessToken: string, owner: string, repo: string) => {
        const octokit = createOctokit(accessToken);
        const response = await octokit.rest.repos.get({ owner, repo });
        return response.data;
    },
);

export type Milestone = NonNullable<PullsGetResponseData["milestone"]>;

export type RepoMilestone =
    RestEndpointMethodTypes["issues"]["listMilestones"]["response"]["data"][number];

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

export type RepoLabel =
    RestEndpointMethodTypes["issues"]["listLabelsForRepo"]["response"]["data"][number];

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

export const getFileContentFromBranch = async (
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
