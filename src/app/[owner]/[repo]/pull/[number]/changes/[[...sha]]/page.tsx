import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import { eq } from "drizzle-orm";
import FileDiff from "~/components/FileDiff";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { accounts } from "~/server/db/schema";
import {
	createOctokit,
	getCommitFiles,
	getPullRequestFiles,
} from "~/server/github";

type PullsListFilesResponseData =
	RestEndpointMethodTypes["pulls"]["listFiles"]["response"]["data"];

interface ChangesPageProps {
	params: Promise<{
		owner: string;
		repo: string;
		number: string;
		sha?: string[];
	}>;
}

export default async function ChangesPage({ params }: ChangesPageProps) {
	const { owner, repo, number, sha } = await params;
	const commitSha = sha && sha.length > 0 ? sha[0] : null;
	const session = await auth();

	if (!session?.user?.id) {
		return (
			<div className="px-6 py-8">
				<p className="text-gray-600">Please sign in to view this pull request.</p>
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

	let files: PullsListFilesResponseData = [];
	try {
		if (commitSha) {
			files = await getCommitFiles(octokit, owner, repo, commitSha);
		} else {
			files = await getPullRequestFiles(
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

	if (!files || files.length === 0) {
		return (
			<div className="px-6 py-8">
				<p className="text-gray-600">
					{commitSha
						? "No files changed in this commit."
						: "No files changed in this pull request."}
				</p>
			</div>
		);
	}

	return (
		<div className="px-6 py-8">
			<h2 className="mb-6 font-semibold text-gray-900 text-lg">
				{commitSha ? (
					<>
						Files Changed (Commit:{" "}
						<code className="font-mono text-sm">{commitSha.slice(0, 7)}</code>
						)
					</>
				) : (
					`Files Changed (${files.length})`
				)}
			</h2>
			{files.map((file) => (
				<FileDiff
					file={file}
					key={file.filename}
					number={number}
					owner={owner}
					repo={repo}
				/>
			))}
		</div>
	);
}
