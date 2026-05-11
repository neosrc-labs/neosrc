"use client";

import { Async } from "~/components/async";
import { UserHoverCard } from "~/components/user-hover-card";
import type {
	Assignee,
	PullsGetResponseData,
	Reviewer,
} from "~/server/github";
import { LabelsSection } from "./label-section";

interface MetadataSectionProps {
	pullRequestPromise: Promise<PullsGetResponseData>;
	owner: string;
	repo: string;
	number: number;
}

export function MetadataSection({
	pullRequestPromise,
	owner,
	repo,
	number,
}: MetadataSectionProps) {
	return (
		<>
			{/* Reviewers Section */}
			<section>
				<h3 className="mb-2 font-semibold text-gray-900 text-sm dark:text-zinc-100">
					Reviewers
				</h3>

				<Async promise={pullRequestPromise} fallback={<FieldSkeleton />}>
					{(pullRequest) =>
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
										<span className="text-gray-600 dark:text-zinc-400">
											{reviewer.login}
										</span>
									</li>
								))}
							</ul>
						) : (
							<p className="text-gray-500 text-sm dark:text-zinc-400">
								No reviewers
							</p>
						)
					}
				</Async>
			</section>

			{/* Assignees Section */}
			<section>
				<h3 className="mb-2 font-semibold text-gray-900 text-sm dark:text-zinc-100">
					Assignees
				</h3>
				<Async promise={pullRequestPromise} fallback={<FieldSkeleton />}>
					{(pullRequest) =>
						pullRequest.assignees && pullRequest.assignees.length > 0 ? (
							<ul className="space-y-2">
								{pullRequest.assignees.map((assignee: Assignee) => (
									<UserHoverCard login={assignee.login}>
										<a
											className="flex items-center gap-2"
											href={assignee.html_url}
										>
											<li
												className="flex items-center gap-2 text-sm"
												key={assignee.login}
											>
												<img
													alt={assignee.login}
													className="h-5 w-5 rounded-full"
													src={assignee.avatar_url}
												/>
												<span className="text-gray-600 dark:text-zinc-400">
													{assignee.login}
												</span>
											</li>
										</a>
									</UserHoverCard>
								))}
							</ul>
						) : (
							<p className="text-gray-500 text-sm dark:text-zinc-400">
								No assignees
							</p>
						)
					}
				</Async>
			</section>

			{/* Milestone Section */}
			<section>
				<h3 className="mb-2 font-semibold text-gray-900 text-sm dark:text-zinc-100">
					Milestone
				</h3>
				<Async promise={pullRequestPromise} fallback={<FieldSkeleton />}>
					{(pullRequest) =>
						pullRequest.milestone ? (
							<p className="text-gray-600 text-sm dark:text-zinc-400">
								{pullRequest.milestone.title}
							</p>
						) : (
							<p className="text-gray-500 text-sm dark:text-zinc-400">
								No milestone
							</p>
						)
					}
				</Async>
			</section>

			{/* Labels Section */}
			<section className="min-h-30">
				<LabelsSection
					pullRequestPromise={pullRequestPromise}
					owner={owner}
					repo={repo}
					number={number}
				/>
			</section>
		</>
	);
}

export function FieldSkeleton() {
	return (
		<section>
			<div className="mb-3 h-5 w-24 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
		</section>
	);
}
