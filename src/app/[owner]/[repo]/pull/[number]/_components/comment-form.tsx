"use client";

import { useCallback, useState } from "react";
import { MarkdownEditor } from "~/components/markdown/MarkdownEditor";
import { api } from "~/trpc/react";

interface CommentFormProps {
	owner: string;
	repo: string;
	number: number;
}

export function CommentForm({ owner, repo, number }: CommentFormProps) {
	const [body, setBody] = useState("");
	const utils = api.useUtils();

	const addComment = api.pulls.addComment.useMutation({
		onSuccess: () => {
			setBody("");
			utils.timeline.list.invalidate();
		},
	});

	const handleSubmit = useCallback(() => {
		if (!body.trim()) return;
		addComment.mutate({ owner, repo, number, body });
	}, [body, owner, repo, number, addComment]);

	return (
		<div className="mt-6 border-gray-200 border-t pt-6">
			<h3 className="mb-3 font-semibold text-gray-900 text-sm dark:text-gray-300">
				Add a comment
			</h3>
			<MarkdownEditor
				disabled={addComment.isPending}
				onChange={setBody}
				placeholder="Leave a comment"
				value={body}
				owner={owner}
				repo={repo}
				footerActions={[
					{
						label: "Comment",
						onClick: () => handleSubmit(),
						variant: "approve",
						disabled: (text: string) => !text.trim(),
					},
				]}
			/>
			{addComment.isError && (
				<p className="mt-2 text-red-600 text-sm">
					Failed to post comment. Please try again.
				</p>
			)}
		</div>
	);
}
