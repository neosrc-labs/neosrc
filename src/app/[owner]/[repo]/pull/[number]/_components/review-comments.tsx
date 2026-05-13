"use client";

import { Loader2, MessageSquare } from "lucide-react";
import { DiffView } from "~/components/DiffView";
import { MarkdownRenderer } from "~/components/markdown/MarkdownRenderer";
import { UserHoverCard } from "~/components/user-hover-card";
import type { ReviewCommentsForReviewData } from "~/server/github";
import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/utils";

interface ReviewCommentsProps {
	owner: string;
	repo: string;
	number: number;
	reviewId: number;
	state?: string;
}

type ReviewComment = ReviewCommentsForReviewData[number];

export function ReviewComments({
	owner,
	repo,
	number,
	reviewId,
	state,
}: ReviewCommentsProps) {
	const { data: comments, isLoading } = api.reviewComments.byReviewId.useQuery(
		{ owner, repo, number, reviewId },
		{ staleTime: 30_000 },
	);

	if (isLoading) {
		return (
			<div className="mt-2 flex items-center gap-2 text-gray-400 text-xs">
				<Loader2 className="h-3 w-3 animate-spin" />
				Loading review comments...
			</div>
		);
	}

	if (!comments || comments.length === 0) {
		return null;
	}

	const topLevel: ReviewComment[] = [];
	const replyMap = new Map<number, ReviewComment[]>();

	for (const comment of comments) {
		if (comment.in_reply_to_id) {
			const existing = replyMap.get(comment.in_reply_to_id) ?? [];
			existing.push(comment);
			replyMap.set(comment.in_reply_to_id, existing);
		} else {
			topLevel.push(comment);
		}
	}

	const byPath: Record<string, ReviewComment[]> = {};
	for (const comment of topLevel) {
		const path = comment.path;
		if (!byPath[path]) byPath[path] = [];
		byPath[path].push(comment);
	}

	return (
		<div className="mt-3 space-y-3 border-gray-200 border-t pt-3 dark:border-zinc-700">
			<p className="flex items-center gap-1.5 font-medium text-gray-500 text-xs dark:text-zinc-400">
				<MessageSquare size={12} />
				Review comments ({comments.length})
			</p>
			{Object.entries(byPath).map(([path, fileComments]) => (
				<div
					key={path}
					className="rounded-lg border border-gray-200 dark:border-zinc-700"
				>
					<div className="border-gray-200 border-b bg-gray-50 px-3 py-1.5 font-mono text-gray-600 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
						{path}
					</div>
					<div className="divide-y divide-gray-200 dark:divide-zinc-700">
						{fileComments.map((comment) => (
							<CommentBlock
								key={comment.id}
								comment={comment}
								replies={replyMap.get(comment.id) ?? []}
								owner={owner}
								repo={repo}
								state={state}
							/>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

function CommentBlock({
	comment,
	replies,
	owner,
	repo,
	state,
}: {
	comment: ReviewComment;
	replies: ReviewComment[];
	owner: string;
	repo: string;
	state?: string;
}) {
	if (!comment.user) {
		return null;
	}

	return (
		<div className="p-3">
			{comment.diff_hunk && (
				<div className="mb-2">
					<DiffView patch={comment.diff_hunk} filename={comment.path} />
				</div>
			)}
			<div className="mb-1 flex items-center gap-2">
				<UserHoverCard login={comment.user.login}>
					<img
						src={comment.user.avatar_url}
						alt={comment.user.login}
						className="h-4 w-4 rounded-full"
					/>
				</UserHoverCard>
				<span className="font-medium text-gray-800 text-xs dark:text-zinc-200">
					{comment.user.login}
				</span>
				<span className="text-gray-400 text-xs">
					{formatRelativeTime(comment.created_at)}
				</span>

				{state === "pending" && (
					<span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-700 text-[10px] font-medium dark:bg-orange-900/30 dark:text-orange-400">
						Pending
					</span>
				)}
			</div>
			<div className="prose prose-sm max-w-none">
				<MarkdownRenderer content={comment.body} owner={owner} repo={repo} />
			</div>
			{replies.map((reply) => {
				if (!reply.user) return null;
				return (
					<div
						key={reply.id}
						className="mt-2 ml-5 border-gray-200 border-l pl-3 dark:border-zinc-700"
					>
						<div className="mb-1 flex items-center gap-2">
							<UserHoverCard login={reply.user.login}>
								<img
									src={reply.user.avatar_url}
									alt={reply.user.login}
									className="h-4 w-4 rounded-full"
								/>
							</UserHoverCard>
							<span className="font-medium text-gray-800 text-xs dark:text-zinc-200">
								{reply.user.login}
							</span>
							<span className="text-gray-400 text-xs">
								{formatRelativeTime(reply.created_at)}
							</span>
						</div>
						<div className="prose prose-sm max-w-none">
							<MarkdownRenderer
								content={reply.body}
								owner={owner}
								repo={repo}
							/>
						</div>
					</div>
				);
			})}
		</div>
	);
}
