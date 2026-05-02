"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { Async, AsyncLink } from "~/components/async";
import type { Commit, PullsGetResponseData, PullsListCommitsResponseData } from "~/server/github";
import { formatRelativeTime } from "~/utils";

interface CommitsSectionProps {
	pullRequestPromise: Promise<PullsGetResponseData>;
	commitsPromise: Promise<PullsListCommitsResponseData> | null;
}

export function CommitsSection({ pullRequestPromise, commitsPromise }: CommitsSectionProps) {
	const pathname = usePathname()
	const currentSha = pathname?.match(/\/changes\/([a-f0-9]{7,40})/)?.[1] ?? null

	const dataPromise = useMemo(
		() => commitsPromise ? Promise.all([pullRequestPromise, commitsPromise]) : null,
		[pullRequestPromise, commitsPromise]
	)

	if (!dataPromise) return null

	return (
		<>
			<h3 className="mb-3 font-semibold text-gray-900 text-sm">
				Commits
				<Async promise={dataPromise} fallback={null}>
					{([, commits]) => <span> ({commits.length})</span>}
				</Async>
			</h3>

			<Async promise={dataPromise} fallback={<CommitsSkeleton />}>
				{([pullRequest, commits]) => {
					if (commits.length === 0) {
						return <p className="text-gray-500 text-sm">No commits</p>
					}

					const baseUrl = `/${pullRequest.base.repo.owner.login}/${pullRequest.base.repo.name}/pull/${pullRequest.number}/changes`

					return (
						<div className="space-y-3">
							{commits.map((commit: Commit) => {
								const isCurrent = currentSha ? commit.sha.startsWith(currentSha) : false
								return (
									<AsyncLink
										key={commit.sha}
										href={`${baseUrl}/${commit.sha}`}
										className={`flex items-start gap-2 text-sm transition-colors hover:bg-gray-50 ${isCurrent ? 'rounded border-blue-500 border-l-2 bg-blue-50 px-2' : ''
											}`}
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
												{commit.commit.message.split('\n')[0]}
											</p>
											{commit.author && commit.commit.committer && (
												<p className="mt-0.5 text-gray-500 text-xs">
													{commit.author.login} committed{' '}
													{formatRelativeTime(commit.commit.committer.date ?? '')}
												</p>
											)}
										</div>
									</AsyncLink>
								)
							})}
						</div>
					)
				}}
			</Async>
		</>
	)
}

function CommitsSkeleton() {
	return (
		<div className="space-y-3">
			{Array.from({ length: 3 }).map((_, i) => (
				<div key={i} className="flex items-start gap-2">
					<div className="mt-0.5 h-5 w-5 shrink-0 animate-pulse rounded-full bg-gray-200" />
					<div className="min-w-0 flex-1">
						<div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
						<div className="mt-1.5 h-3 w-1/3 animate-pulse rounded bg-gray-200" />
					</div>
				</div>
			))}
		</div>
	)
}
