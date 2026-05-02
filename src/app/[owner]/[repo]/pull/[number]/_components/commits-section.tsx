"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { use } from "react";
import type { Commit, PullsGetResponseData, PullsListCommitsResponseData } from "~/server/github";
import { formatRelativeTime } from "~/utils";

interface CommitsSectionProps {
	pullRequestPromise: Promise<PullsGetResponseData>;
	commitsPromise: Promise<PullsListCommitsResponseData> | null;
}

export function CommitsSection({ pullRequestPromise, commitsPromise }: CommitsSectionProps) {
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
