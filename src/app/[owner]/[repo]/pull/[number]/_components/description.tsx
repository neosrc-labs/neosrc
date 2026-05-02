"use client";

import { Async } from "~/components/async";
import { MarkdownRenderer } from "~/components/MarkdownRenderer";
import { Reactions } from "~/components/Reactions";
import type { PullsGetResponseData } from "~/server/github";
import { formatRelativeTime } from "~/utils";

interface PullRequestDescriptionSectionProps {
	owner: string;
	repo: string;
	number: number;
	pullRequestPromise: Promise<PullsGetResponseData>;
}

export function PullRequestDescriptionSection({
	owner,
	repo,
	number,
	pullRequestPromise,
}: PullRequestDescriptionSectionProps) {
	return (
		<div>
			{/* PR Header */}
			<div className="mb-6">

				<div className="mb-2 flex items-center gap-2">
					<Async promise={pullRequestPromise} fallback={<div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" />}>
						{(pullRequest) => {
							const isMerged = pullRequest.merged;
							const isOpen = pullRequest.state === "open";
							const isDraft = pullRequest.draft;

							let statusText = "";
							let statusColor = "";

							if (isMerged) {
								statusText = "Merged";
								statusColor = "bg-purple-100 text-purple-800";
							} else if (isOpen) {
								statusText = "Open";
								statusColor = "bg-green-100 text-green-800";
							} else {
								statusText = "Closed";
								statusColor = "bg-red-100 text-red-800";
							}

							return (
								<>
									<span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs ${statusColor}`}>
										{statusText}
									</span>
									{isDraft && (
										<span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 font-medium text-gray-800 text-xs">
											Draft
										</span>
									)}
								</>
							)
						}}
					</Async>
					<Async promise={pullRequestPromise} fallback={<div className="h-8 w-96 animate-pulse rounded bg-gray-200" />}>
						{(pullRequest) => (
							<h1 className="font-bold text-2xl text-gray-900">
								{pullRequest.title}
							</h1>
						)}
					</Async>
					<h1 className="text-2xl text-gray-400">
						#{number}
					</h1>
				</div>

				<Async promise={pullRequestPromise} fallback={<div className="h-5 w-104 animate-pulse rounded bg-gray-200" />}>
					{(pullRequest) => (
						<div className="mt-2 flex items-center gap-2">
							<div className="text-gray-600 text-sm">
								<span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">{pullRequest.base.ref}</span>
								<span className="mx-2">←</span>
								<span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">{pullRequest.head.ref}</span>
							</div>
							<div className="flex items-center gap-2 text-gray-600 text-sm">
								opened by <img
									alt={pullRequest.user?.login}
									className="h-5 w-5 rounded-full"
									src={pullRequest.user?.avatar_url}
								/>
								{pullRequest.user?.login}{" "}
								{formatRelativeTime(pullRequest.created_at)}
							</div>
						</div>
					)}
				</Async>
			</div>

			<div className="mt-4 border-gray-200 border-t pt-4" />

			<Async promise={pullRequestPromise} fallback={<div className="h-48 w-fill animate-pulse rounded bg-gray-200" />}>
				{(pullRequest) => (
					<>
						{/* PR Description */}
						<div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
							<div className="prose prose-sm max-w-none">
								{pullRequest.body ? (
									<MarkdownRenderer content={pullRequest.body} />
								) : (
									<p className="text-gray-500 italic">
										No description provided.
									</p>
								)}
							</div>
						</div>
					</>
				)}
			</Async>

			{/* Reactions */}
			<Reactions number={number} owner={owner} repo={repo} />
		</div >
	);
}
