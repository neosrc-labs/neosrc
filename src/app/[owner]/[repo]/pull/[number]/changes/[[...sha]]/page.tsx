import type { Metadata } from "next";
import { Suspense } from "react";
import { githubAccessToken } from "~/server/auth";
import {
	type CommitData,
	getCommit,
	getPullRequest,
	getPullRequestCommits,
	type PullsGetResponseData,
	type PullsListCommitsResponseData,
} from "~/server/github";
import { generatePRMetadata } from "~/server/metadata";
import { FilesSection } from "../../_components/files-client";

interface ChangesPageProps {
	params: Promise<{
		owner: string;
		repo: string;
		number: string;
		sha?: string[];
	}>;
}

export async function generateMetadata({
	params,
}: ChangesPageProps): Promise<Metadata> {
	const { owner, repo, number } = await params;
	return generatePRMetadata(owner, repo, number);
}

export default async function ChangesPage({ params }: ChangesPageProps) {
	const { owner, repo, number: numberStr, sha } = await params;
	const number = parseInt(numberStr, 10);
	const commitSha = sha && sha.length > 0 ? sha[0] : null;

	const accessToken = await githubAccessToken();

	if (!accessToken) {
		return (
			<div className="px-6 py-8">
				<p className="text-gray-600 dark:text-gray-400">
					Please sign in to view this pull request.
				</p>
			</div>
		);
	}
	const pullRequest = getPullRequest(accessToken, owner, repo, number);

	let commit: Promise<CommitData> | null = null;
	let commits: Promise<PullsListCommitsResponseData> | null = null;
	try {
		if (commitSha) {
			// Fetch commit details and all PR commits in parallel and don't block the main page render
			commit = getCommit(accessToken, owner, repo, commitSha);
			commits = getPullRequestCommits(accessToken, owner, repo, number);
		}
	} catch {
		return (
			<div className="px-6 py-8">
				<p className="text-gray-600 dark:text-gray-400">
					{commitSha
						? "Failed to fetch commit changes."
						: "Failed to fetch file changes."}
				</p>
			</div>
		);
	}

	return (
		<div className="px-6 py-8">
			<Suspense fallback={commitSha ? <CommitHeaderSkeleton /> : undefined}>
				<CommitHeader
					commitPromise={commit}
					commitsPromise={commits}
					pullRequestPromise={pullRequest}
					number={number}
					owner={owner}
					repo={repo}
					commitSha={commitSha ?? null}
				/>
			</Suspense>
			<Suspense>
				<FilesSection
					number={number}
					owner={owner}
					repo={repo}
					commitSha={commitSha ?? undefined}
				/>
			</Suspense>
		</div>
	);
}

interface CommitHeaderProps {
	commitPromise: Promise<CommitData> | null;
	commitsPromise: Promise<PullsListCommitsResponseData> | null;
	pullRequestPromise: Promise<PullsGetResponseData>;
	owner: string;
	repo: string;
	number: number;
	commitSha: string | null;
}

async function CommitHeader({
	commitPromise,
	commitsPromise,
	pullRequestPromise,
	owner,
	repo,
	number,
	commitSha,
}: CommitHeaderProps) {
	const pullRequest = await pullRequestPromise;

	if (commitPromise == null || commitsPromise == null) {
		return <div>Files Changed ({pullRequest.changed_files})</div>;
	}

	const commit = await commitPromise;
	const commits = await commitsPromise;

	const currentIndex = commits.findIndex((c) => c.sha === commitSha);
	const prevCommit = currentIndex > 0 ? commits[currentIndex - 1] : null;
	const nextCommit =
		currentIndex >= 0 && currentIndex < commits.length - 1
			? commits[currentIndex + 1]
			: null;
	return (
		<div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
			<div className="mb-3 flex items-center justify-between">
				<h2 className="font-semibold text-gray-900 text-lg dark:text-gray-100">
					{commit.commit.message.split("\n")[0]}
				</h2>
				<div className="flex gap-2">
					{prevCommit ? (
						<a
							className="whitespace-nowrap rounded-md bg-white px-3 py-1.5 font-medium text-gray-700 text-sm ring-1 ring-gray-300 transition-colors hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700"
							href={`/${owner}/${repo}/pull/${number}/changes/${prevCommit.sha}`}
						>
							← Previous
						</a>
					) : (
						<button
							className="cursor-not-allowed rounded-md bg-gray-100 px-3 py-1.5 font-medium text-gray-400 text-sm ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:ring-gray-700"
							disabled
							type="button"
						>
							← Previous
						</button>
					)}
					{nextCommit ? (
						<a
							className="whitespace-nowrap rounded-md bg-white px-3 py-1.5 font-medium text-gray-700 text-sm ring-1 ring-gray-300 transition-colors hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700"
							href={`/${owner}/${repo}/pull/${number}/changes/${nextCommit.sha}`}
						>
							Next →
						</a>
					) : (
						<button
							className="cursor-not-allowed rounded-md bg-gray-100 px-3 py-1.5 font-medium text-gray-400 text-sm ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:ring-gray-700"
							disabled
							type="button"
						>
							Next →
						</button>
					)}
				</div>
			</div>
			{commit.commit.message.split("\n").length > 1 && (
				<p className="whitespace-pre-wrap text-gray-600 text-sm dark:text-gray-400">
					{commit.commit.message.split("\n").slice(1).join("\n").trim()}
				</p>
			)}
			<div className="mt-3 flex items-center gap-2">
				{commit.author ? (
					<>
						<a
							className="flex items-center gap-2"
							href={commit.author.html_url}
							rel="noopener noreferrer"
							target="_blank"
						>
							<img
								alt={commit.author.login}
								className="h-5 w-5 rounded-full"
								src={commit.author.avatar_url}
							/>
						</a>

						<a
							className="flex items-center gap-2"
							href={commit.author.html_url}
							rel="noopener noreferrer"
							target="_blank"
						>
							<span className="text-gray-600 text-sm hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">
								{commit.author.login}
							</span>
						</a>
						<span className="text-gray-600 text-sm dark:text-gray-400">
							committed{" "}
							{new Date(
								commit.commit.committer?.date || "",
							).toLocaleDateString()}
						</span>
					</>
				) : (
					<span className="text-gray-600 text-sm">
						{commit.commit.author?.name} committed{" "}
						{new Date(commit.commit.committer?.date || "").toLocaleDateString()}
					</span>
				)}
				<code className="ml-2 font-mono text-gray-500 text-xs dark:text-gray-400">
					{commit.sha.slice(0, 7)}
				</code>
			</div>
		</div>
	);
}

function CommitHeaderSkeleton() {
	return (
		<div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
			<div className="mb-3 h-8 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
			<div className="mt-3 flex items-center gap-2">
				<div className="h-5 w-5 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
				<div className="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
			</div>
		</div>
	);
}
