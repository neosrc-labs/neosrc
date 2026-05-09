"use client";

import type { ReviewCommentData } from "~/server/github";
import { MarkdownRenderer } from "./markdown/MarkdownRenderer";

interface InlineCommentProps {
	comment: ReviewCommentData;
}

const formatDate = (dateStr: string) => {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return "just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	return date.toLocaleDateString();
};

export function InlineComment({ comment }: InlineCommentProps) {
	return (
		<div className="border-gray-200 border-t bg-white dark:border-zinc-700 dark:bg-zinc-950">
			<div className="flex items-center gap-2 bg-gray-50 px-4 py-2 dark:bg-zinc-900">
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
					{formatDate(comment.created_at)}
				</span>
			</div>
			<div className="prose prose-sm dark:prose-invert max-w-none px-4 py-2">
				<MarkdownRenderer content={comment.body} />
			</div>
		</div>
	);
}
