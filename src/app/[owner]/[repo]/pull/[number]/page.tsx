import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { MarkdownRenderer } from "~/components/MarkdownRenderer";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { accounts } from "~/server/db/schema";
import { createOctokit, getPullRequest } from "~/server/github";
import { generatePRMetadata } from "~/server/metadata";

type PullsGetResponseData =
	RestEndpointMethodTypes["pulls"]["get"]["response"]["data"];

interface PageProps {
	params: Promise<{
		owner: string;
		repo: string;
		number: string;
	}>;
}

export async function generateMetadata({
	params,
}: PageProps): Promise<Metadata> {
	const { owner, repo, number } = await params;
	return generatePRMetadata(owner, repo, number);
}

export default async function PullRequestPage({ params }: PageProps) {
	const { owner, repo, number } = await params;
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

	let pullRequest: PullsGetResponseData | null = null;
	try {
		pullRequest = await getPullRequest(
			octokit,
			owner,
			repo,
			parseInt(number, 10),
		);
	} catch {
		return (
			<div className="px-6 py-8">
				<p className="text-gray-600">Failed to fetch pull request data.</p>
			</div>
		);
	}

	return (
		<div className="px-6 py-8">
			{/* PR Header */}
			<div className="mb-6">
				<h1 className="font-bold text-2xl text-gray-900">
					{pullRequest.title}
				</h1>
				<p className="mt-2 text-gray-600 text-sm">
					#{number} opened by {pullRequest.user?.login}
				</p>
			</div>

			{/* PR Description */}
			<div className="prose prose-sm max-w-none">
				{pullRequest.body ? (
					<MarkdownRenderer content={pullRequest.body} />
				) : (
					<p className="text-gray-500 italic">No description provided.</p>
				)}
			</div>

			{/* Comments Placeholder */}
			<div className="mt-8 border-gray-200 border-t pt-6">
				<h2 className="mb-4 font-semibold text-gray-900 text-lg">Comments</h2>
				<p className="text-gray-500 text-sm">Comments section coming soon.</p>
			</div>
		</div>
	);
}
