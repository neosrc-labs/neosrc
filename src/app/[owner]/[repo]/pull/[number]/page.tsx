import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Async } from "~/components/async";
import { MarkdownRenderer } from "~/components/MarkdownRenderer";
import { Reactions } from "~/components/Reactions";
import { githubAccessToken } from "~/server/auth";
import { getPullRequest } from "~/server/github";
import { generatePRMetadata } from "~/server/metadata";
import { PullRequestDescriptionSection } from "./_components/description";

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
	const { owner, repo, number: numberAsStr } = await params;
	const accessToken = await githubAccessToken();
	const number = parseInt(numberAsStr, 10);

	if (!accessToken) {
		return (
			<div className="px-6 py-8">
				<p className="text-gray-600">
					Please sign in to view this pull request.
				</p>
			</div>
		);
	}

	let pullRequest: Promise<PullsGetResponseData> = getPullRequest(
		accessToken,
		owner,
		repo,
		number,
	);

	return (
		<Suspense>
			<PullRequestPageContent
				pullRequestPromise={pullRequest}
				number={number}
				owner={owner}
				repo={repo}
			/>
		</Suspense>
	);
}

interface PullRequestPageContentProps {
	owner: string;
	repo: string;
	number: number;
	pullRequestPromise: Promise<PullsGetResponseData>;
}

function PullRequestPageContent({ owner, repo, number, pullRequestPromise }: PullRequestPageContentProps) {
	return (
		<div className="px-6 py-8">

			<PullRequestDescriptionSection
				owner={owner}
				repo={repo}
				number={number}
				pullRequestPromise={pullRequestPromise}
			/>

			{/* Comments Placeholder */}
			<div className="mt-8 border-gray-200 border-t pt-6">
				<h2 className="mb-4 font-semibold text-gray-900 text-lg">Comments</h2>
				<p className="text-gray-500 text-sm">Comments section coming soon.</p>
			</div>
		</div>
	);
}

