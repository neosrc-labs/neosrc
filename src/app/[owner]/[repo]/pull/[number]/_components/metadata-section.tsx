"use client";

import { Async } from "~/components/async";
import type {
	PullsGetResponseData,
	Reviewer,
} from "~/server/github";
import { AssigneeSection } from "./assignee-section";
import { LabelsSection } from "./label-section";
import { MilestoneSection } from "./milestone-section";
import { ReviewerSection } from "./reviewer-section";

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
				<ReviewerSection
					pullRequestPromise={pullRequestPromise}
					owner={owner}
					repo={repo}
					number={number}
				/>
			</section>

			{/* Assignees Section */}
			<section>
				<AssigneeSection
					pullRequestPromise={pullRequestPromise}
					owner={owner}
					repo={repo}
					number={number}
				/>
			</section>

			{/* Milestone Section */}
			<section>
				<MilestoneSection
					pullRequestPromise={pullRequestPromise}
					owner={owner}
					repo={repo}
					number={number}
				/>
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
