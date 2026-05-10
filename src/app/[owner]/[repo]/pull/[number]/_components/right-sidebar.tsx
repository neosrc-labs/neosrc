"use client";

import { Suspense } from "react";
import type {
	PullsGetResponseData,
	PullsListCommitsResponseData,
} from "~/server/github";
import { CommitsSection } from "./commits-section";
import { MetadataSection } from "./metadata-section";

interface RightSidebarProps {
	pullRequestPromise: Promise<PullsGetResponseData> | null;
	commitsPromise: Promise<PullsListCommitsResponseData> | null;
	owner: string;
	repo: string;
	number: number;
}

export default function RightSidebar({
	pullRequestPromise,
	commitsPromise,
	owner,
	repo,
	number,
}: RightSidebarProps) {
	if (!pullRequestPromise) {
		return (
			<aside className="border-gray-200 border-l bg-white px-4 py-6 dark:border-zinc-800 dark:bg-zinc-950">
				<p className="text-gray-500 text-sm dark:text-gray-400">
					No pull request data available.
				</p>
			</aside>
		);
	}

	return (
		<aside className="flex h-full flex-col border-gray-200 border-l bg-white px-4 py-6 dark:border-zinc-800 dark:bg-zinc-950">
			{/* Metadata Section - Sticky Top */}
			<div className="sticky top-0 z-10 space-y-6 bg-white pb-4 dark:bg-zinc-950">
				<MetadataSection
					pullRequestPromise={pullRequestPromise}
					owner={owner}
					repo={repo}
					number={number}
				/>
			</div>
			{/* Commits Section - Scrollable */}
			<div className="min-h-0 flex-1 overflow-y-auto border-gray-200 border-t pt-6 dark:border-zinc-800">
				<CommitsSection
					commitsPromise={commitsPromise}
					pullRequestPromise={pullRequestPromise}
				/>
			</div>
		</aside>
	);
}
