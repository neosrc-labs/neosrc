import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import { eq } from "drizzle-orm";
import { Suspense, type ReactNode } from "react";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { accounts } from "~/server/db/schema";
import {
	createOctokit,
	getCheckRuns,
	getPullRequest,
	getPullRequestCommits,
} from "~/server/github";
import { ResizableLayout } from "~/components/ResizableLayout";
import LeftSidebar from "./_components/left-sidebar";
import RightSidebar from "./_components/right-sidebar";
import { headers } from 'next/headers'

type PullsGetResponseData =
	RestEndpointMethodTypes["pulls"]["get"]["response"]["data"];
type PullsListCommitsResponseData =
	RestEndpointMethodTypes["pulls"]["listCommits"]["response"]["data"];

interface LayoutProps {
	children: ReactNode;
	params: Promise<{
		owner: string;
		repo: string;
		number: string;
	}>;
}

export default async function PullRequestLayout({
	children,
	params,
}: LayoutProps) {
	const { owner, repo, number } = await params;
	const session = await auth();
	const pathname = (await headers()).get('x-pathname') ?? ''
	const isFilesActive = pathname.includes('/changes'); // TODO: This is probably a better way to do this
	const isConversationActive = !isFilesActive;

	let pullRequest: Promise<PullsGetResponseData> | null = null;
	let commits: Promise<PullsListCommitsResponseData> | null = null;
	let checks: Promise<Array<{
		name: string;
		conclusion: string | null;
		status: string;
		html_url?: string | undefined;
	}>> | null = null;

	if (session?.user?.id) {
		const [account] = await db
			.select({ accessToken: accounts.access_token })
			.from(accounts)
			.where(eq(accounts.userId, session.user.id))
			.limit(1);

		if (account?.accessToken) {
			const octokit = createOctokit(account.accessToken);
			commits = getPullRequestCommits(octokit, owner, repo, parseInt(number, 10));
			pullRequest = getPullRequest(octokit, owner, repo, parseInt(number, 10));

			// Fetch check runs if we have the PR head SHA
			checks = pullRequest
				.then(async pullRequest => {
					if (pullRequest?.head?.sha) {
						const checksResult = await getCheckRuns(
							octokit,
							owner,
							repo,
							pullRequest.head.sha,
						);

						return (checksResult.check_runs || []).map(
							(check: {
								name: string;
								conclusion: string | null;
								status: string;
								html_url?: string | undefined;
							}) => ({
								name: check.name,
								conclusion: check.conclusion,
								status: check.status,
								html_url: check.html_url,
							}),
						);
					}
					return [];
				});
		}
	}

	return (
		<ResizableLayout
			leftSidebar={
				<LeftSidebar
					isConversationActive={isConversationActive}
					isFilesActive={isFilesActive}
					checksPromise={checks}
					number={number}
					owner={owner}
					repo={repo}
				/>
			}
			rightSidebar={
				<Suspense>
					<RightSidebarWrapper commitsPromise={commits} pullRequestPromise={pullRequest} />
				</Suspense>
			}
		>
			{children}
		</ResizableLayout>
	);
}

interface RightSidebarWrapperProps {
	pullRequestPromise: Promise<PullsGetResponseData> | null;
	commitsPromise: Promise<PullsListCommitsResponseData> | null;
}

async function RightSidebarWrapper({ commitsPromise, pullRequestPromise }: RightSidebarWrapperProps) {
	const commits = (await commitsPromise) || [];
	const pullRequest = await pullRequestPromise;
	return (
		<RightSidebar commits={commits} pullRequest={pullRequest} />
	);
}

