import { eq } from "drizzle-orm";
import type { ReactNode } from "react";
import { ResizableLayout } from "~/components/ResizableLayout";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { accounts } from "~/server/db/schema";
import {
	createOctokit,
	getCheckRuns,
	getPullRequest,
	getPullRequestCommits,
	type PullsGetResponseData,
	type PullsListCommitsResponseData,
} from "~/server/github";
import LeftSidebar from "./_components/left-sidebar";
import RightSidebar from "./_components/right-sidebar";

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
	const { owner, repo, number: numberStr } = await params;
	const number = parseInt(numberStr, 10);
	const session = await auth();

	let pullRequest: Promise<PullsGetResponseData> | null = null;
	let commits: Promise<PullsListCommitsResponseData> | null = null;
	let checks: Promise<
		Array<{
			name: string;
			conclusion: string | null;
			status: string;
			html_url?: string | undefined;
		}>
	> | null = new Promise(() => { });

	if (session?.user?.id) {
		const [account] = await db
			.select({ accessToken: accounts.access_token })
			.from(accounts)
			.where(eq(accounts.userId, session.user.id))
			.limit(1);

		if (account?.accessToken) {
			const accessToken = account.accessToken;
			commits = getPullRequestCommits(accessToken, owner, repo, number);
			pullRequest = getPullRequest(accessToken, owner, repo, number);

			// Fetch check runs if we have the PR head SHA
			checks = pullRequest.then(async (pullRequest) => {
				if (pullRequest?.head?.sha) {
					const checksResult = await getCheckRuns(
						accessToken,
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
					pullRequestPromise={pullRequest}
					checksPromise={checks}
					number={number}
					owner={owner}
					repo={repo}
				/>
			}
			rightSidebar={
				<RightSidebar
					commitsPromise={commits}
					pullRequestPromise={pullRequest}
				/>
			}
		>
			{children}
		</ResizableLayout>
	);
}

