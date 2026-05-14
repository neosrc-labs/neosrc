"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { Async, AsyncLink } from "~/components/async";
import { CommitHoverCard } from "~/components/commit-hover-card";
import type {
	Commit,
	PullsGetResponseData,
	PullsListCommitsResponseData,
} from "~/server/github";
import { formatRelativeTime } from "~/utils";

interface CommitsSectionProps {
	pullRequestPromise: Promise<PullsGetResponseData>;
	commitsPromise: Promise<PullsListCommitsResponseData> | null;
}

export function CommitsSection({
	pullRequestPromise,
	commitsPromise,
}: CommitsSectionProps) {
	const pathname = usePathname();
	const currentSha =
		pathname?.match(/\/changes\/([a-f0-9]{7,40})/)?.[1] ?? null;

	const dataPromise = useMemo(
		() =>
			commitsPromise ? Promise.all([pullRequestPromise, commitsPromise]) : null,
		[pullRequestPromise, commitsPromise],
	);

	if (!dataPromise) return null;

	return (
		<>
			<h3 className="mb-3 font-semibold text-gray-900 text-sm dark:text-gray-100">
				Commits
				<Async fallback={null} promise={dataPromise}>
					{([, commits]) => <span> ({commits.length})</span>}
				</Async>
			</h3>

			<Async fallback={<CommitsSkeleton />} promise={dataPromise}>
				{([pullRequest, commits]) => {
					if (commits.length === 0) {
						return (
							<p className="text-gray-500 text-sm dark:text-gray-400">
								No commits
							</p>
						);
					}

					const baseUrl = `/${pullRequest.base.repo.owner.login}/${pullRequest.base.repo.name}/pull/${pullRequest.number}/changes`;

					return (
						<div className="space-y-3">
							{commits.map((commit: Commit) => {
								const isCurrent = currentSha
									? commit.sha.startsWith(currentSha)
									: false;
								return (
									<CommitHoverCard
										baseUrl={baseUrl}
										commit={commit}
										key={commit.sha}
									>
										<AsyncLink
											className={`flex items-start gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800 ${
												isCurrent
													? "border-blue-500 border-l-2 bg-blue-50 dark:bg-blue-950"
													: ""
											}`}
											href={`${baseUrl}/${commit.sha}`}
										>
											{commit.author && (
												<img
													alt={commit.author.login}
													className="mt-0.5 h-5 w-5 shrink-0 rounded-full"
													src={commit.author.avatar_url}
												/>
											)}
											<div className="min-w-0">
												<p className="truncate font-medium text-gray-900 text-sm dark:text-gray-100">
													{commit.commit.message.split("\n")[0]}
												</p>
												{commit.author && commit.commit.committer && (
													<p className="mt-0.5 text-gray-500 text-xs dark:text-gray-400">
														{commit.author.login} committed{" "}
														{formatRelativeTime(
															commit.commit.committer.date ?? "",
														)}
													</p>
												)}
											</div>
										</AsyncLink>
									</CommitHoverCard>
								);
							})}
						</div>
					);
				}}
			</Async>
		</>
	);
}

function CommitsSkeleton() {
	return (
		<div className="space-y-3">
			{Array.from({ length: 3 }, (_, i) => i).map((i) => (
				<div className="flex items-start gap-2" key={`commit-skeleton-${i}`}>
					<div className="mt-0.5 h-5 w-5 shrink-0 animate-pulse rounded-full bg-gray-200" />
					<div className="min-w-0 flex-1">
						<div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
						<div className="mt-1.5 h-3 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
					</div>
				</div>
			))}
		</div>
	);
}
