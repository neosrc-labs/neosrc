"use client";

import { useCallback, useState } from "react";
import type { ReviewCommentData } from "~/server/github";
import { api } from "~/trpc/react";
import { InlineComment } from "./InlineComment";
import { MarkdownEditor } from "./markdown/MarkdownEditor";

interface InlineCommentThreadProps {
	parentComment: ReviewCommentData;
	replies: ReviewCommentData[];
	owner: string;
	repo: string;
	number: number;
}

export function InlineCommentThread({
	parentComment,
	replies,
	owner,
	repo,
	number,
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
		<div className="border border-gray-200 dark:border-gray-700">
			<InlineComment comment={parentComment} />
			{replies.map((comment) => (
				<InlineComment comment={comment} key={comment.id} />
			))}
			{showReplyForm ? (
				<div className="border-gray-200 border-t p-2 dark:border-gray-700">
					<MarkdownEditor
						disabled={replyMutation.isPending}
						onChange={setReplyBody}
						onCancel={() => {
							setShowReplyForm(false);
							setReplyBody("");
						}}
						onSubmit={handleReply}
						placeholder="Write a reply..."
						submitLabel="Reply"
						value={replyBody}
						owner={owner}
						repo={repo}
					/>
					{replyMutation.isError && (
						<p className="mt-1 text-red-600 text-xs">
							Failed to post reply. Please try again.
						</p>
					)}
				</div>
			) : (
				<button
					className="flex w-full cursor-pointer items-center gap-1.5 border-gray-200 border-t px-4 py-1.5 text-gray-500 text-xs hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
					onClick={() => setShowReplyForm(true)}
					type="button"
				>
					<svg
						className="h-3 w-3"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<title>Reply</title>
						<path
							d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
						/>
					</svg>
					Reply
				</button>
			)}
		</div>
	);
}
