import { Async } from "~/components/async";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "~/components/ui/hover-card";
import { UserHoverCard } from "~/components/user-hover-card";
import type {
	Assignee,
	Label,
	PullsGetResponseData,
	Reviewer,
} from "~/server/github";

interface MetadataSectionProps {
	pullRequestPromise: Promise<PullsGetResponseData>;
}

export function MetadataSection({ pullRequestPromise }: MetadataSectionProps) {
	return (
		<>
			{/* Reviewers Section */}
			<section>
				<h3 className="mb-2 font-semibold text-gray-900 text-sm dark:text-gray-100">
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
										<span className="text-gray-600 dark:text-gray-400">
											{reviewer.login}
										</span>
									</li>
								))}
							</ul>
						) : (
							<p className="text-gray-500 text-sm dark:text-gray-400">
								No reviewers
							</p>
						)
					}
				</Async>
			</section>

			{/* Assignees Section */}
			<section>
				<h3 className="mb-2 font-semibold text-gray-900 text-sm dark:text-gray-100">
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
												<span className="text-gray-600 dark:text-gray-400">
													{assignee.login}
												</span>
											</li>
										</a>
									</UserHoverCard>
								))}
							</ul>
						) : (
							<p className="text-gray-500 text-sm dark:text-gray-400">
								No assignees
							</p>
						)
					}
				</Async>
			</section>

			{/* Milestone Section */}
			<section>
				<h3 className="mb-2 font-semibold text-gray-900 text-sm dark:text-gray-100">
					Milestone
				</h3>
				<Async promise={pullRequestPromise} fallback={<FieldSkeleton />}>
					{(pullRequest) =>
						pullRequest.milestone ? (
							<p className="text-gray-600 text-sm dark:text-gray-400">
								{pullRequest.milestone.title}
							</p>
						) : (
							<p className="text-gray-500 text-sm dark:text-gray-400">
								No milestone
							</p>
						)
					}
				</Async>
			</section>

			{/* Labels Section */}
			<section className="min-h-30">
				<h3 className="mb-2 font-semibold text-gray-900 text-sm dark:text-gray-100">
					Labels
				</h3>
				<Async promise={pullRequestPromise} fallback={<FieldSkeleton />}>
					{(pullRequest) =>
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
							<p className="text-gray-500 text-sm dark:text-gray-400">
								No labels
							</p>
						)
					}
				</Async>
			</section>
		</>
	);
}

function FieldSkeleton() {
	return (
		<section>
			<div className="mb-3 h-5 w-24 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
		</section>
	);
}
