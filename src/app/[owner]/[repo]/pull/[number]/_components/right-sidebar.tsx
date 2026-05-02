"use client";

import { Suspense } from "react";
import { MetadataSection, MetadataSectionSkeleton } from "./metadata-section";
import type { PullsGetResponseData, PullsListCommitsResponseData } from "~/server/github";
import { CommitsSection } from "./commits-section";

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
				<MetadataSection pullRequestPromise={pullRequestPromise} />
			</div>
			{/* Commits Section - Scrollable */}
			<div className="min-h-0 flex-1 overflow-y-auto border-gray-200 border-t pt-6">
				<CommitsSection pullRequestPromise={pullRequestPromise} commitsPromise={commitsPromise} />
			</div>
		</aside>
	);
}

