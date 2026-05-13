"use client";

import { useEffect, useState } from "react";
import FileDiff from "~/components/FileDiff";
import { useFiles } from "~/hooks/files";
import { api } from "~/trpc/react";

interface FilesSectionProps {
	owner: string;
	repo: string;
	number: number;
	commitSha?: string;
}

export function FilesSection({
	owner,
	repo,
	number,
	commitSha,
}: FilesSectionProps) {
	const [showComments, setShowComments] = useState(true);
	const [reviewMode, setReviewMode] = useState(false);
	const { files } = useFiles({ owner, repo, number, commitSha });

	const { data: allComments = [] } = api.reviewComments.list.useQuery(
		{ owner, repo, number },
		{ staleTime: 30_000 },
	);

	const { data: pendingReview } = api.reviews.getPending.useQuery(
		{ owner, repo, number },
		{ staleTime: 30_000 },
	);

	const pendingReviewId = pendingReview?.reviewId ?? null;

	useEffect(() => {
		if (pendingReviewId) {
			setReviewMode(true);
		}
	}, [pendingReviewId]);

	return (
		<div>
			<div className="mb-4 flex items-center justify-between">
				<h2 className="font-semibold text-gray-900 text-lg dark:text-gray-100">
					Files Changed ({files.length})
				</h2>
				<div className="flex items-center gap-2">
					{!pendingReviewId && (
						<button
							className={`cursor-pointer rounded-md px-3 py-1.5 font-medium text-sm transition-colors ${
								reviewMode
									? "bg-blue-600 text-white hover:bg-blue-700"
									: "bg-white text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 dark:bg-zinc-800 dark:text-gray-300 dark:ring-zinc-600 dark:hover:bg-zinc-700"
							}`}
							onClick={() => setReviewMode(!reviewMode)}
							type="button"
						>
							{reviewMode ? "Review Mode" : "Single Comment"}
						</button>
					)}
					{pendingReviewId && (
						<span className="rounded-full bg-yellow-100 px-3 py-1.5 font-medium text-xs text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
							Review in progress
						</span>
					)}
					<button
						className="cursor-pointer rounded-md bg-white px-3 py-1.5 font-medium text-gray-700 text-sm ring-1 ring-gray-300 transition-colors hover:bg-gray-50 dark:bg-zinc-800 dark:text-gray-300 dark:ring-zinc-600 dark:hover:bg-zinc-700"
						onClick={() => setShowComments(!showComments)}
						type="button"
					>
						{showComments ? "Hide comments" : "Show comments"}
					</button>
				</div>
			</div>
			{files.map((file) => {
				const fileComments = allComments.filter(
					(c) => c.path === file.filename,
				);

				return (
					<FileDiff
						comments={fileComments}
						file={file}
						key={file.filename}
						number={number.toString()}
						owner={owner}
						repo={repo}
						showComments={showComments}
						pendingReviewId={pendingReviewId}
						reviewMode={reviewMode}
					/>
				);
			})}
		</div>
	);
}
