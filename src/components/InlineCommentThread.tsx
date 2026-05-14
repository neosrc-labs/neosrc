"use client";

import { useCallback, useState } from "react";
import type { ReviewCommentData } from "~/server/github";
import { api } from "~/trpc/react";
import { MarkdownEditor } from "./markdown/MarkdownEditor";
import { formatRelativeTime } from "~/utils";
import { MarkdownRenderer } from "./markdown/MarkdownRenderer";

interface InlineCommentThreadProps {
	parentComment: ReviewCommentData;
	replies: ReviewCommentData[];
	owner: string;
	repo: string;
	number: number;
	pendingReviewId?: number | null;
}

export function InlineCommentThread({
	parentComment,
	replies,
	owner,
	repo,
	number,
	pendingReviewId,
}: InlineCommentThreadProps) {
	const [showReplyForm, setShowReplyForm] = useState(false);
	const [replyBody, setReplyBody] = useState("");
	const utils = api.useUtils();

	const replyMutation = api.reviewComments.reply.useMutation({
		onSuccess: () => {
			setReplyBody("");
			setShowReplyForm(false);
			utils.reviewComments.list.invalidate();
		},
	});

	const handleReply = useCallback(() => {
		if (!replyBody.trim()) return;
		replyMutation.mutate({
			owner,
			repo,
			number,
			body: replyBody,
			inReplyTo: parentComment.id,
		});
	}, [replyBody, parentComment.id, replyMutation, owner, repo, number]);

	return (
		<div className="border border-gray-200 dark:border-zinc-700 max-w-[1100px] font-sans">
			{/* Parent Comment */}
			<div className="bg-white border-b-gray-200 dark:border-b-zinc-700 border-solid border-b-1 dark:bg-zinc-900">
				<div className="flex items-center gap-2 px-4 pt-3">
					{/* biome-ignore lint/performance/noImgElement: established pattern in codebase */}
					<img
						alt={parentComment.user?.login ?? "user"}
						className="h-5 w-5 flex-shrink-0 rounded-full"
						src={parentComment.user?.avatar_url ?? ""}
					/>
					<span className="font-medium text-gray-900 text-sm dark:text-gray-100">
						{parentComment.user?.login ?? "unknown"}
					</span>
					<span className="text-gray-500 text-xs">
						{formatRelativeTime(parentComment.created_at)}
					</span>
					{pendingReviewId != null &&
						parentComment.pull_request_review_id === pendingReviewId && (
							<span className="rounded-full bg-yellow-100 px-2 py-0.5 font-medium text-xs text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
								Pending
							</span>
						)}
				</div>
				<div className="prose prose-sm dark:prose-invert max-w-none px-4 py-2 mx-6">
					<MarkdownRenderer content={parentComment.body} />
				</div>
			</div>


			{replies.map((comment) => (
				<div className="bg-gray-50 dark:bg-zinc-950 ml-3" key={comment.id}>
					<div className="flex items-center gap-2 px-4 pt-3">
						{/* biome-ignore lint/performance/noImgElement: established pattern in codebase */}
						<img
							alt={comment.user?.login ?? "user"}
							className="h-5 w-5 flex-shrink-0 rounded-full"
							src={comment.user?.avatar_url ?? ""}
						/>
						<span className="font-medium text-gray-900 text-sm dark:text-gray-100">
							{comment.user?.login ?? "unknown"}
						</span>
						<span className="text-gray-500 text-xs">
							{formatRelativeTime(comment.created_at)}
						</span>
						{pendingReviewId != null &&
							comment.pull_request_review_id === pendingReviewId && (
								<span className="rounded-full bg-yellow-100 px-2 py-0.5 font-medium text-xs text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
									Pending
								</span>
							)}
					</div>
					<div className="prose prose-sm dark:prose-invert max-w-none px-4 py-2 mx-6">
						<MarkdownRenderer content={comment.body} />
					</div>
				</div>
			))}
			{showReplyForm ? (
				<div className="p-2 ml-3">
					<MarkdownEditor
						disabled={replyMutation.isPending}
						onChange={setReplyBody}
						onCancel={() => {
							setShowReplyForm(false);
							setReplyBody("");
						}}
						placeholder="Write a reply..."
						value={replyBody}
						owner={owner}
						repo={repo}
						footerActions={[
							{
								label: "Reply",
								onClick: () => handleReply(),
								variant: "approve",
								disabled: (text: string) => !text.trim(),
							},
						]}
					/>
					{replyMutation.isError && (
						<p className="mt-1 text-red-600 text-xs">
							Failed to post reply. Please try again.
						</p>
					)}
				</div>
			) : (
				<div className="flex w-full px-4 py-2 bg-gray-50 dark:bg-zinc-950 ml-3">
					<button
						className="flex w-full cursor-text items-center rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-gray-400 text-xs hover:border-gray-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-gray-500 dark:hover:border-zinc-400 transition-colors duration-200"
						onClick={() => setShowReplyForm(true)}
						type="button"
					>
						Reply...
					</button>
				</div>
			)}
		</div>
	);
}
