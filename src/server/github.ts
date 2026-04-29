import { Octokit } from "@octokit/rest";

export function createOctokit(accessToken: string) {
  return new Octokit({
    auth: accessToken,
  });
}

export type { Octokit };

export async function getPullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
) {
  const response = await octokit.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });
  return response.data;
}

export async function getPullRequestCommits(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
) {
  const response = await octokit.pulls.listCommits({
    owner,
    repo,
    pull_number: pullNumber,
  });
  return response.data;
}

export async function getCheckRuns(
  octokit: Octokit,
  owner: string,
  repo: string,
  commitSha: string
) {
  const response = await octokit.request(
    "GET /repos/{owner}/{repo}/commits/{commit_sha}/check-runs",
    {
      owner,
      repo,
      commit_sha: commitSha,
    }
  );
  return response.data;
}
