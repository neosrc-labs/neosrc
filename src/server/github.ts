import { Octokit, type RestEndpointMethodTypes } from "@octokit/rest";
import { cache } from "react";

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
export type ReviewCommentData =
	RestEndpointMethodTypes["pulls"]["listReviewComments"]["response"]["data"][number];
export type ReviewCommentsForReviewData =
	RestEndpointMethodTypes["pulls"]["listCommentsForReview"]["response"]["data"];
export type PullRequestReview =
	RestEndpointMethodTypes["pulls"]["listReviews"]["response"]["data"][number];

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
	// biome-ignore lint/suspicious/noExplicitAny: Octokit type for createReview event doesn't allow leaving it blank, but API supports it
	const response = await octokit.pulls.createReview({
		owner,
		repo,
		pull_number: pullNumber,
		event,
		body,
		comments,
	} as any);
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

export const getAuthenticatedUser = async (accessToken: string) => {
	const octokit = createOctokit(accessToken);
	const response = await octokit.rest.users.getAuthenticated();
	return response.data;
};

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
	) => {
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

export const getPullRequestReviewCommentsForReview = cache(
	async (
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
	},
);

export const createPullRequestReviewComment = async (
	accessToken: string,
	pullRequestNodeId: number,
	pullRequestReviewNodeId?: string,
	path: string,
	line: number,
	side: "LEFT" | "RIGHT",
	body: string,
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

	const comment = result.data.addPullRequestReviewThread.thread.comments.nodes[0];
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

// TODO: Check if generators support cache() or maybe interally we can cache?
export async function* getPullRequestFilesStream(
	accessToken: string,
	owner: string,
	repo: string,
	pullNumber: number,
	commitSha?: string,
) {
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
