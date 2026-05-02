"use client";

import { Async } from "~/components/async";
import { MarkdownRenderer } from "~/components/MarkdownRenderer";
import { Reactions } from "~/components/Reactions";
import type { PullsGetResponseData } from "~/server/github";

interface PullRequestDescriptionSectionProps {
	owner: string;
	repo: string;
	number: number;
	pullRequestPromise: Promise<PullsGetResponseData>;
}

export function PullRequestDescriptionSection({ owner, repo, number, pullRequestPromise }: PullRequestDescriptionSectionProps) {
	return (
		<div>
			{/* PR Header */}
			<div className="mb-6">
				<Async promise={pullRequestPromise}>
					{pullRequest => (
						<h1 className="font-bold text-2xl text-gray-900">
							{pullRequest.title}
						</h1>
					)}
				</Async>

				<Async promise={pullRequestPromise}>
					{pullRequest => (
						<p className="mt-2 text-gray-600 text-sm">
							#{number} opened by {pullRequest.user?.login}
						</p>
					)}
				</Async>
			</div>

			{/* PR Description */}
			<Async promise={pullRequestPromise}>
				{pullRequest => (
					<div className="prose prose-sm max-w-none">
						{pullRequest.body ? (
							<MarkdownRenderer content={pullRequest.body} />
						) : (
							<p className="text-gray-500 italic">No description provided.</p>
						)}
					</div>
				)}
			</Async>

			{/* Reactions */}
			<div className="mt-4 border-gray-200 border-t pt-4">
				<Reactions
					number={number}
					owner={owner}
					repo={repo}
				/>
			</div>
		</div>
	);
}
