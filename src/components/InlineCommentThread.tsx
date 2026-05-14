"use client";

import { SmilePlus, SquarePen } from "lucide-react";
import { useCallback, useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
import type { ReviewCommentData } from "~/server/github";
import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/utils";
import { MarkdownEditor } from "./markdown/MarkdownEditor";
import { MarkdownRenderer } from "./markdown/MarkdownRenderer";

interface InlineCommentThreadProps {
	parentComment: ReviewCommentData;
	replies: ReviewCommentData[];
	owner: string;
	repo: string;
	number: number;
	pendingReviewId?: number | null;
}

const allReactions = [
	"+1",
	"-1",
	"laugh",
	"confused",
	"heart",
	"hooray",
	"rocket",
	"eyes",
] as const;

const reactionEmojis: Record<string, string> = {
	"+1": "👍",
	"-1": "👎",
	laugh: "😄",
	confused: "😕",
	heart: "❤️",
	hooray: "🎉",
	rocket: "🚀",
	eyes: "👀",
};

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
	const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
	const [editBody, setEditBody] = useState("");
	const [savedBodies, setSavedBodies] = useState<Record<number, string>>({});
	const utils = api.useUtils();

	const { data: currentUserData } = api.users.currentUser.useQuery();
	const currentUserLogin = currentUserData?.login ?? "";

	const replyMutation = api.reviewComments.reply.useMutation({
		onSuccess: () => {
			setReplyBody("");
			setShowReplyForm(false);
			utils.reviewComments.list.invalidate();
		},
	});

	const updateMutation = api.reviewComments.update.useMutation({
		onMutate: ({ commentId, body }) => {
			setSavedBodies((prev) => ({ ...prev, [commentId]: body }));
			setEditingCommentId(null);
		},
		onError: (_, { commentId }) => {
			setSavedBodies((prev) => {
				const next = { ...prev };
				delete next[commentId];
				return next;
			});
			setEditingCommentId(commentId);
		},
	});

	const reactMutation =
		api.reactions.togglePullRequestReviewComment.useMutation({
			onSettled: () => {
				utils.reviewComments.list.invalidate({ owner, repo, number });
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

	const handleSaveEdit = (commentId: number) => {
		if (!editBody.trim()) return;
		updateMutation.mutate({ owner, repo, commentId, body: editBody });
	};

	const handleReact = useCallback(
		(commentId: number, content: (typeof allReactions)[number]) => {
			reactMutation.mutate({ owner, repo, commentId, content });
		},
		[reactMutation, owner, repo],
	);

	return (
		<div className="font-san">
			<Comment
				isParent={true}
				comment={parentComment}
				isPending={
					pendingReviewId != null &&
					parentComment.pull_request_review_id === pendingReviewId
				}
				isAuthor={parentComment.user?.login === currentUserLogin}
				isEditing={editingCommentId === parentComment.id}
				editBody={editingCommentId === parentComment.id ? editBody : ""}
				displayBody={savedBodies[parentComment.id] ?? parentComment.body}
				onStartEdit={() => {
					setEditBody(parentComment.body);
					setEditingCommentId(parentComment.id);
				}}
				onEditBodyChange={setEditBody}
				onCancelEdit={() => {
					setEditingCommentId(null);
					setEditBody("");
				}}
				onSaveEdit={() => handleSaveEdit(parentComment.id)}
				onReact={(content) => handleReact(parentComment.id, content)}
				owner={owner}
				repo={repo}
			/>

			{replies.map((comment) => (
				<div className="bg-gray-50 dark:bg-zinc-950" key={comment.id}>
					<Comment
						isParent={false}
						comment={comment}
						isPending={
							pendingReviewId != null &&
							comment.pull_request_review_id === pendingReviewId
						}
						isAuthor={comment.user?.login === currentUserLogin}
						isEditing={editingCommentId === comment.id}
						editBody={editingCommentId === comment.id ? editBody : ""}
						displayBody={savedBodies[comment.id] ?? comment.body}
						onStartEdit={() => {
							setEditBody(comment.body);
							setEditingCommentId(comment.id);
						}}
						onEditBodyChange={setEditBody}
						onCancelEdit={() => {
							setEditingCommentId(null);
							setEditBody("");
						}}
						onSaveEdit={() => handleSaveEdit(comment.id)}
						onReact={(content) => handleReact(comment.id, content)}
						owner={owner}
						repo={repo}
					/>
				</div>
			))}
			{showReplyForm ? (
				<div className="p-2 bg-gray-50 dark:bg-zinc-950">
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
				<div className="flex w-full bg-gray-50 px-6 py-2 dark:bg-zinc-950">
					<button
						className="flex w-full cursor-text items-center rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-gray-400 text-xs transition-colors duration-200 hover:border-gray-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-gray-500 dark:hover:border-zinc-400"
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

function Comment({
	comment,
	isPending,
	isAuthor,
	isEditing,
	isParent,
	editBody,
	displayBody,
	onStartEdit,
	onEditBodyChange,
	onCancelEdit,
	onSaveEdit,
	onReact,
	owner,
	repo,
}: {
	comment: ReviewCommentData;
	isPending: boolean;
	isAuthor: boolean;
	isEditing: boolean;
	isParent: boolean;
	editBody: string;
	displayBody: string;
	onStartEdit: () => void;
	onEditBodyChange: (body: string) => void;
	onCancelEdit: () => void;
	onSaveEdit: () => void;
	onReact: (content: (typeof allReactions)[number]) => void;
	owner: string;
	repo: string;
}) {
	const [reactionOpen, setReactionOpen] = useState(false);

	return (
		<div className={isParent ? "bg-white border-b-gray-200 dark:border-b-zinc-700 border-solid border-b-1 dark:bg-zinc-900" : "bg-gray-50 dark:bg-zinc-950 ml-3"}>
			<div className="flex items-center justify-between gap-2 px-4 pt-3">
				<div className="flex min-w-0 items-center gap-2">
					{/* biome-ignore lint/performance/noImgElement: established pattern in codebase */}
					<img
						alt={comment.user?.login ?? "user"}
						className="h-5 w-5 flex-shrink-0 rounded-full"
						src={comment.user?.avatar_url ?? ""}
					/>
					<span className="truncate font-medium text-gray-900 text-sm dark:text-gray-100">
						{comment.user?.login ?? "unknown"}
					</span>
					<span className="whitespace-nowrap text-gray-500 text-xs">
						{formatRelativeTime(comment.created_at)}
					</span>
					{isPending && (
						<span className="whitespace-nowrap rounded-full bg-yellow-100 px-2 py-0.5 font-medium text-xs text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
							Pending
						</span>
					)}
				</div>
				{!isEditing && (
					<div className="flex flex-shrink-0 items-center gap-0.5">
						<Popover open={reactionOpen} onOpenChange={setReactionOpen}>
							<PopoverTrigger asChild>
								<button
									type="button"
									className="cursor-pointer rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-gray-300"
								>
									<SmilePlus size={14} />
								</button>
							</PopoverTrigger>
							<PopoverContent
								className="w-fit bg-white p-2 dark:bg-zinc-950"
								align="end"
							>
								<div className="flex gap-1">
									{allReactions.map((content) => (
										<button
											key={content}
											type="button"
											onClick={() => {
												onReact(content);
												setReactionOpen(false);
											}}
											className="cursor-pointer rounded p-1 text-lg transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800"
										>
											{reactionEmojis[content] ?? content}
										</button>
									))}
								</div>
							</PopoverContent>
						</Popover>
						{isAuthor && (
							<button
								type="button"
								className="cursor-pointer rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-gray-300"
								onClick={onStartEdit}
							>
								<SquarePen size={14} />
							</button>
						)}
					</div>
				)}
			</div>
			<div className="prose prose-sm dark:prose-invert mx-6 max-w-none px-4 py-2">
				{isEditing ? (
					<MarkdownEditor
						value={editBody}
						onChange={onEditBodyChange}
						onCancel={onCancelEdit}
						owner={owner}
						repo={repo}
						minHeight={`${Math.min(Math.max(editBody.split("\n").length * 28, 120), 400)}px`}
						footerActions={[
							{
								label: "Save",
								onClick: onSaveEdit,
								variant: "approve",
								disabled: (text: string) => !text.trim(),
							},
						]}
					/>
				) : (
					<MarkdownRenderer content={displayBody} owner={owner} repo={repo} />
				)}
			</div>
		</div>
	);
}
