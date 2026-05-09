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

export function createOctokit(accessToken: string) {
	return new Octokit({
		auth: accessToken,
	});
}

export type UsersGetByUsernameResponseData =
	RestEndpointMethodTypes["users"]["getByUsername"]["response"]["data"];

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

export const createPullRequestReview = async (
	accessToken: string,
	owner: string,
	repo: string,
	pullNumber: number,
	event: "APPROVE" | "COMMENT" | "REQUEST_CHANGES",
	body?: string,
) => {
	const octokit = createOctokit(accessToken);
	const response = await octokit.pulls.createReview({
		owner,
		repo,
		pull_number: pullNumber,
		event,
		body,
	});
	return response.data;
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

export const createPullRequestReviewComment = async (
	accessToken: string,
	owner: string,
	repo: string,
	pullNumber: number,
	commitId: string,
	path: string,
	line: number,
	side: "LEFT" | "RIGHT",
	body: string,
) => {
	const octokit = createOctokit(accessToken);
	const response = await octokit.pulls.createReviewComment({
		owner,
		repo,
		pull_number: pullNumber,
		commit_id: commitId,
		path,
		line,
		side,
		body,
	});
	return response.data;
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
