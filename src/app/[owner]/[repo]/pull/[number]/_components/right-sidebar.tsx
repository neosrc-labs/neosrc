"use client";

import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, use } from "react";
import { formatRelativeTime } from "~/utils";

type PullsGetResponseData =
	RestEndpointMethodTypes["pulls"]["get"]["response"]["data"];
type PullsListCommitsResponseData =
	RestEndpointMethodTypes["pulls"]["listCommits"]["response"]["data"];
type Label = NonNullable<PullsGetResponseData["labels"]>[number];
type Reviewer = NonNullable<
	PullsGetResponseData["requested_reviewers"]
>[number];
type Assignee = NonNullable<PullsGetResponseData["assignees"]>[number];
type Commit = PullsListCommitsResponseData[number];

interface RightSidebarProps {
	pullRequestPromise: Promise<PullsGetResponseData> | null;
	commitsPromise: Promise<PullsListCommitsResponseData> | null;
}

export default function RightSidebar({
	pullRequestPromise,
	commitsPromise,
}: RightSidebarProps) {
	if (!pullRequestPromise) {
		return (
			<aside className="border-gray-200 border-l bg-white px-4 py-6">
				<p className="text-gray-500 text-sm">No pull request data available.</p>
			</aside>
		);
	}

	return (
		<aside className="flex h-full flex-col border-gray-200 border-l bg-white px-4 py-6">
			{/* Metadata Section - Sticky Top */}
			<div className="sticky top-0 z-10 space-y-6 bg-white pb-4">
				<Suspense fallback={<MetadataSectionSkeleton />}>
					<MetadataSection pullRequestPromise={pullRequestPromise} />
				</Suspense>
			</div>
			{/* Commits Section - Scrollable */}
			<div className="min-h-0 flex-1 overflow-y-auto border-gray-200 border-t pt-6">
				<Suspense>
					<CommitsSection pullRequestPromise={pullRequestPromise} commitsPromise={commitsPromise} />
				</Suspense>
			</div>
		</aside>
	);
}


function MetadataSectionSkeleton() {
	return (
		<aside className="flex h-full flex-col bg-white py-6">
			<div className="sticky top-0 z-10 space-y-6 bg-white pb-5">
				{["Labels", "Reviewers", "Assignees", "Milestone"].map((section) => (
					<section key={section}>
						<div className="mb-3 h-5 w-16 animate-pulse rounded bg-gray-200" />
						<div className="flex flex-wrap gap-2 mb-7">
							<div className="h-5 w-20 animate-pulse rounded-full bg-gray-200" />
						</div>
					</section>
				))}
			</div>
		</aside>
	)
}

interface MetadataSectionProps {
	pullRequestPromise: Promise<PullsGetResponseData>;
}

function MetadataSection({ pullRequestPromise }: MetadataSectionProps) {
	const pullRequest = use(pullRequestPromise);
	return (
		<>
			{/* Labels Section */}
			< section >
				<h3 className="mb-2 font-semibold text-gray-900 text-sm">Labels</h3>
				{
					pullRequest.labels && pullRequest.labels.length > 0 ? (
						<div className="flex flex-wrap gap-2">
							{pullRequest.labels.map((label: Label) => (
								<span
									className="inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs"
									key={label.name}
									style={{
										backgroundColor: `#${label.color}20`,
										color: `#${label.color}`,
									}}
								>
									{label.name}
								</span>
							))}
						</div>
					) : (
						<p className="text-gray-500 text-sm">No labels</p>
					)
				}
			</section >

			{/* Reviewers Section */}
			< section >
				<h3 className="mb-2 font-semibold text-gray-900 text-sm">
					Reviewers
				</h3>
				{
					pullRequest.requested_reviewers &&
						pullRequest.requested_reviewers.length > 0 ? (
						<ul className="space-y-2">
							{pullRequest.requested_reviewers.map((reviewer: Reviewer) => (
								<li
									className="flex items-center gap-2 text-sm"
									key={reviewer.login}
								>
									<img
										alt={reviewer.login}
										className="h-5 w-5 rounded-full"
										src={reviewer.avatar_url}
									/>
									<span className="text-gray-600">{reviewer.login}</span>
								</li>
							))}
						</ul>
					) : (
						<p className="text-gray-500 text-sm">No reviewers</p>
					)
				}
			</section >

			{/* Assignees Section */}
			< section >
				<h3 className="mb-2 font-semibold text-gray-900 text-sm">
					Assignees
				</h3>
				{
					pullRequest.assignees && pullRequest.assignees.length > 0 ? (
						<ul className="space-y-2">
							{pullRequest.assignees.map((assignee: Assignee) => (
								<li
									className="flex items-center gap-2 text-sm"
									key={assignee.login}
								>
									<img
										alt={assignee.login}
										className="h-5 w-5 rounded-full"
										src={assignee.avatar_url}
									/>
									<span className="text-gray-600">{assignee.login}</span>
								</li>
							))}
						</ul>
					) : (
						<p className="text-gray-500 text-sm">No assignees</p>
					)
				}
			</section >

			{/* Milestone Section */}
			< section >
				<h3 className="mb-2 font-semibold text-gray-900 text-sm">
					Milestone
				</h3>
				{
					pullRequest.milestone ? (
						<p className="text-gray-600 text-sm">
							{pullRequest.milestone.title}
						</p>
					) : (
						<p className="text-gray-500 text-sm">No milestone</p>
					)
				}
			</section >
		</>
	);
}

interface CommitsSectionProps {
	pullRequestPromise: Promise<PullsGetResponseData>;
	commitsPromise: Promise<PullsListCommitsResponseData> | null;
}

function CommitsSection({ pullRequestPromise, commitsPromise }: CommitsSectionProps) {
	if (!commitsPromise) {
		return <></>
	}

	const pullRequest = use(pullRequestPromise);
	const commits = use(commitsPromise);

	const pathname = usePathname();
	const currentSha =
		pathname?.match(/\/changes\/([a-f0-9]{7,40})/)?.[1] || null;

	return (
		<>
			<h3 className="mb-3 font-semibold text-gray-900 text-sm">
				Commits ({commits.length})
			</h3>
			{commits.length > 0 ? (
				<div className="space-y-3">
					{commits.map((commit: Commit) => {
						const isCurrent = currentSha
							? commit.sha.startsWith(currentSha)
							: false;
						return (
							<Link
								className={`flex items-start gap-2 text-sm transition-colors hover:bg-gray-50 ${isCurrent
									? "rounded border-blue-500 border-l-2 bg-blue-50 px-2"
									: ""
									}`}
								href={`/${pullRequest.base.repo.owner.login}/${pullRequest.base.repo.name}/pull/${pullRequest.number}/changes/${commit.sha}`}
								key={commit.sha}
							>
								{commit.author && (
									<img
										alt={commit.author.login}
										className="mt-0.5 h-5 w-5 shrink-0 rounded-full"
										src={commit.author.avatar_url}
									/>
								)}
								<div className="min-w-0">
									<p className="truncate font-medium text-gray-900 text-sm">
										{commit.commit.message.split("\n")[0]}
									</p>
									{commit.author && commit.commit.committer && (
										<p className="mt-0.5 text-gray-500 text-xs">
											{commit.author.login} committed{" "}
											{formatRelativeTime(commit.commit.committer.date ?? "")}
										</p>
									)}
								</div>
							</Link>
						);
					})}
				</div>
			) : (
				<p className="text-gray-500 text-sm">No commits</p>
			)}

		</>
	)
}
