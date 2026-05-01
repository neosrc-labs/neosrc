import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import FileDiff from "~/components/FileDiff";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { accounts } from "~/server/db/schema";
import {
	createOctokit,
	getCommit,
	getPullRequestCommits,
	getPullRequestFiles,
} from "~/server/github";
import { generatePRMetadata } from "~/server/metadata";

type PullsListFilesResponseData =
	RestEndpointMethodTypes["pulls"]["listFiles"]["response"]["data"];
type PullsListCommitsResponseData =
	RestEndpointMethodTypes["pulls"]["listCommits"]["response"]["data"];
type CommitData =
	RestEndpointMethodTypes["repos"]["getCommit"]["response"]["data"];

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
	const { owner, repo, number, sha } = await params;
	const commitSha = sha && sha.length > 0 ? sha[0] : null;
	const session = await auth();

	if (!session?.user?.id) {
		return (
			<div className="px-6 py-8">
				<p className="text-gray-600">
					Please sign in to view this pull request.
				</p>
			</div>
		);
	}

	const [account] = await db
		.select({ accessToken: accounts.access_token })
		.from(accounts)
		.where(eq(accounts.userId, session.user.id))
		.limit(1);

	if (!account?.accessToken) {
		return (
			<div className="px-6 py-8">
				<p className="text-gray-600">GitHub account not connected properly.</p>
			</div>
		);
	}

	const octokit = createOctokit(account.accessToken);

	let files: Promise<PullsListFilesResponseData> = new Promise(() => { });
	let commit: Promise<CommitData> | null = null;
	let commits: Promise<PullsListCommitsResponseData> | null = null;

	try {
		if (commitSha) {
			// Fetch commit details and all PR commits in parallel and don't block the main page render
			commit = getCommit(octokit, owner, repo, commitSha);
			commits = getPullRequestCommits(octokit, owner, repo, parseInt(number, 10));
			files = commit.then(commit => commit.files ?? []);
		} else {
			files = getPullRequestFiles(
				octokit,
				owner,
				repo,
				parseInt(number, 10),
			);
		}
	} catch {
		return (
			<div className="px-6 py-8">
				<p className="text-gray-600">
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
					filesPromise={files}
					number={number}
					owner={owner}
					repo={repo}
					commitSha={commitSha ?? null}
				/>
			</Suspense>
			<Suspense>
				<FilesSection
					files={files}
					number={number}
					owner={owner}
					repo={repo}
				/>
			</Suspense>
		</div>
	);
}

interface FilesSectionProps {
	files: Promise<PullsListFilesResponseData>;
	owner: string;
	repo: string;
	number: string;
}

async function FilesSection({ files, owner, repo, number }: FilesSectionProps) {
	const filesResolved = await files;
	return (
		filesResolved.map((file) => (
			<FileDiff
				file={file}
				key={file.filename}
				number={number}
				owner={owner}
				repo={repo}
			/>
		))
	)
}

interface CommitHeaderProps {
	commitPromise: Promise<CommitData> | null;
	commitsPromise: Promise<PullsListCommitsResponseData> | null;
	filesPromise: Promise<PullsListFilesResponseData>;
	owner: string;
	repo: string;
	number: string;
	commitSha: string | null;
}

async function CommitHeader({ commitPromise, commitsPromise, filesPromise, owner, repo, number, commitSha }: CommitHeaderProps) {

	if (commitPromise == null || commitsPromise == null) {
		const files = await filesPromise;
		return (
			<div>
				Files Changed ({files.length})
			</div>
		)
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
		<div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
			<div className="mb-3 flex items-center justify-between">
				<h2 className="font-semibold text-gray-900 text-lg">
					{commit.commit.message.split("\n")[0]}
				</h2>
				<div className="flex gap-2">
					{prevCommit ? (
						<a
							className="whitespace-nowrap rounded-md bg-white px-3 py-1.5 font-medium text-gray-700 text-sm ring-1 ring-gray-300 transition-colors hover:bg-gray-50"
							href={`/${owner}/${repo}/pull/${number}/changes/${prevCommit.sha}`}
						>
							← Previous
						</a>
					) : (
						<button
							className="cursor-not-allowed rounded-md bg-gray-100 px-3 py-1.5 font-medium text-gray-400 text-sm ring-1 ring-gray-200"
							disabled
							type="button"
						>
							← Previous
						</button>
					)}
					{nextCommit ? (
						<a
							className="whitespace-nowrap rounded-md bg-white px-3 py-1.5 font-medium text-gray-700 text-sm ring-1 ring-gray-300 transition-colors hover:bg-gray-50"
							href={`/${owner}/${repo}/pull/${number}/changes/${nextCommit.sha}`}
						>
							Next →
						</a>
					) : (
						<button
							className="cursor-not-allowed rounded-md bg-gray-100 px-3 py-1.5 font-medium text-gray-400 text-sm ring-1 ring-gray-200"
							disabled
							type="button"
						>
							Next →
						</button>
					)}
				</div>
			</div>
			{commit.commit.message.split("\n").length > 1 && (
				<p className="whitespace-pre-wrap text-gray-600 text-sm">
					{commit.commit.message.split("\n").slice(1).join("\n").trim()}
				</p>
			)}
			<div className="mt-3 flex items-center gap-2">
				{commit.author ? (
					<>
						<a className="flex items-center gap-2" href={commit.author.html_url} rel="noopener noreferrer" target="_blank">
							<img
								alt={commit.author.login}
								className="h-5 w-5 rounded-full"
								src={commit.author.avatar_url}
							/>
						</a>

						<a className="flex items-center gap-2" href={commit.author.html_url} rel="noopener noreferrer" target="_blank">
							<span className="text-gray-600 text-sm hover:text-gray-900">
								{commit.author.login}
							</span>
						</a>
						<span className="text-gray-600 text-sm">
							committed{" "}
							{new Date(
								commit.commit.committer?.date || "",
							).toLocaleDateString()}
						</span>
					</>
				) : (
					<span className="text-gray-600 text-sm">
						{commit.commit.author?.name} committed{" "}
						{new Date(
							commit.commit.committer?.date || "",
						).toLocaleDateString()}
					</span>
				)}
				<code className="ml-2 font-mono text-gray-500 text-xs">
					{commit.sha.slice(0, 7)}
				</code>
			</div>
		</div>
	);
}

function CommitHeaderSkeleton() {
	return (
		<div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
			<div className="mb-3 h-8 w-3/4 animate-pulse rounded bg-gray-200" />
			<div className="mt-3 flex items-center gap-2">
				<div className="h-5 w-5 animate-pulse rounded-full bg-gray-200" />
				<div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
			</div>
		</div>
	);
}
