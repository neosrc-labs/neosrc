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
	RestEndpointMethodTypes["issues"]["listEvents"]["response"]["data"][number];

export function createOctokit(accessToken: string) {
	return new Octokit({
		auth: accessToken,
	});
}

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
