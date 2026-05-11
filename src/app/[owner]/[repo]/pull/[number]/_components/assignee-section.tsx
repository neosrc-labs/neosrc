import { Async } from "~/components/async";
import type { Assignee, PullsGetResponseData } from "~/server/github";
import { FieldSkeleton } from "./metadata-section";
import { UserHoverCard } from "~/components/user-hover-card";

export function AssigneeSection({ pullRequestPromise }: {
	pullRequestPromise: Promise<PullsGetResponseData>,
}) {
	return (
		<>
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
		</>
	);
}
