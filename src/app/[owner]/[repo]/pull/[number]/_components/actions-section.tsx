"use client";

import { ChevronDown, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Async } from "~/components/async";
import { MarkdownEditor } from "~/components/markdown/MarkdownEditor";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import type { PullsGetResponseData } from "~/server/github";
import { api } from "~/trpc/react";


interface ActionSectionProps {
	owner: string;
	repo: string;
	number: number;
	pullRequestPromise: Promise<PullsGetResponseData> | null;
	currentUserLogin?: string;
}

export function ActionSection({
	owner,
	repo,
	number,
	pullRequestPromise,
	currentUserLogin,
}: ActionSectionProps) {
	const router = useRouter();
	const utils = api.useUtils();
	const [approved, setApproved] = useState(false);
	const [markedReady, setMarkedReady] = useState(false);
	const [approveBody, setApproveBody] = useState("");
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [requestChangesBody, setRequestChangesBody] = useState("");
	const [requestChangesPopoverOpen, setRequestChangesPopoverOpen] =
		useState(false);
	const [submitReviewBody, setSubmitReviewBody] = useState("");
	const [submitReviewPopoverOpen, setSubmitReviewPopoverOpen] = useState(false);
	const [submitReviewEvent, setSubmitReviewEvent] = useState<
		"APPROVE" | "COMMENT" | "REQUEST_CHANGES"
	>("COMMENT");

	const { data: pendingReview } = api.reviews.getPending.useQuery(
		{ owner, repo, number },
		{ staleTime: 30_000 },
	);

	const approveMutation = api.pulls.approve.useMutation({
		onSuccess: (_, variables) => {
			setApproved(true);
			if (variables.body) {
				setPopoverOpen(false);
				setApproveBody("");
				utils.timeline.list.invalidate();
			}
		},
	});

	const requestChangesMutation = api.pulls.approve.useMutation({
		onSuccess: () => {
			setRequestChangesPopoverOpen(false);
			setRequestChangesBody("");
			utils.timeline.list.invalidate();
		},
	});

	const submitReviewMutation = api.reviews.submit.useMutation({
		onSuccess: () => {
			setSubmitReviewPopoverOpen(false);
			setSubmitReviewBody("");
			utils.reviews.getPending.invalidate();
			utils.reviewComments.list.invalidate();
			utils.timeline.list.invalidate();
		},
	});

	const dismissReviewMutation = api.reviews.dismiss.useMutation({
		onSuccess: () => {
			utils.reviews.getPending.invalidate();
			utils.reviewComments.list.invalidate();
		},
	});

	const markReadyMutation = api.pulls.markReadyForReview.useMutation({
		onSuccess: () => {
			setMarkedReady(true);
			router.refresh();
		},
	});

	const handleApprove = useCallback(() => {
		approveMutation.mutate({ owner, repo, number, event: "APPROVE" });
	}, [owner, repo, number, approveMutation]);

	const handleApproveWithComment = useCallback(() => {
		approveMutation.mutate({
			owner,
			repo,
			number,
			event: "APPROVE",
			body: approveBody,
		});
	}, [owner, repo, number, approveBody, approveMutation]);

	const handleRequestChanges = useCallback(() => {
		requestChangesMutation.mutate({
			owner,
			repo,
			number,
			event: "REQUEST_CHANGES",
			body: requestChangesBody,
		});
	}, [owner, repo, number, requestChangesBody, requestChangesMutation]);

	const handleSubmitReview = useCallback(() => {
		if (!pendingReview) return;
		submitReviewMutation.mutate({
			owner,
			repo,
			number,
			reviewId: pendingReview.reviewId,
			event: submitReviewEvent,
			body: submitReviewBody || undefined,
		});
	}, [
		owner,
		repo,
		number,
		pendingReview,
		submitReviewEvent,
		submitReviewBody,
		submitReviewMutation,
	]);

	const handleCancelReview = useCallback(() => {
		if (!pendingReview) return;
		dismissReviewMutation.mutate({
			owner,
			repo,
			number,
			reviewId: pendingReview.reviewId,
		});
	}, [owner, repo, number, pendingReview, dismissReviewMutation]);

	const handleMarkReady = useCallback(() => {
		markReadyMutation.mutate({ owner, repo, number });
	}, [owner, repo, number, markReadyMutation]);

	const skeleton = (
		<>
			<div className="h-9 w-full animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
			<div className="h-9 w-full animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
			<div className="h-9 w-full animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
		</>
	);

	const pendingCommentsCount = pendingReview?.comments.length ?? 0;

	const reviewInProgress = pendingReview != null && (
		<div className="space-y-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900/50 dark:bg-yellow-900/10">
			<div className="flex items-center justify-between">
				<span className="font-medium text-sm text-yellow-800 dark:text-yellow-400">
					Review in progress
				</span>
				<button
					className="cursor-pointer text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300"
					disabled={dismissReviewMutation.isPending}
					onClick={handleCancelReview}
					type="button"
					title="Cancel review"
				>
					<X className="h-4 w-4" />
				</button>
			</div>
			<p className="text-xs text-yellow-700 dark:text-yellow-500">
				{pendingCommentsCount} comment{pendingCommentsCount !== 1 ? "s" : ""}{" "}
				pending
			</p>
			<Popover
				open={submitReviewPopoverOpen}
				onOpenChange={setSubmitReviewPopoverOpen}
			>
				<PopoverTrigger asChild>
					<button
						className="w-full cursor-pointer rounded-md bg-[#2da44e] px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-[#218838] disabled:cursor-not-allowed disabled:opacity-50"
						disabled={
							submitReviewMutation.isPending || dismissReviewMutation.isPending
						}
						type="button"
					>
						{submitReviewMutation.isPending ? "Submitting..." : "Submit Review"}
					</button>
				</PopoverTrigger>
				<PopoverContent
					align="end"
					className="w-[42rem] bg-white p-4 dark:bg-zinc-950"
					side="left"
					sideOffset={8}
				>
					<div className="mb-3 flex gap-2">
						{(["COMMENT", "APPROVE", "REQUEST_CHANGES"] as const).map(
							(event) => (
								<button
									key={event}
									className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 font-medium text-xs transition-colors ${submitReviewEvent === event
										? event === "APPROVE"
											? "bg-[#2da44e] text-white"
											: event === "REQUEST_CHANGES"
												? "bg-[#cf222e] text-white"
												: "bg-gray-200 text-gray-800 dark:bg-zinc-700 dark:text-gray-200"
										: "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-400 dark:hover:bg-zinc-700"
										}`}
									onClick={() => setSubmitReviewEvent(event)}
									type="button"
								>
									{event === "APPROVE"
										? "Approve"
										: event === "REQUEST_CHANGES"
											? "Request Changes"
											: "Comment"}
								</button>
							),
						)}
					</div>
					<MarkdownEditor
						disabled={submitReviewMutation.isPending}
						minHeight="150px"
						onChange={setSubmitReviewBody}
						onCancel={() => {
							setSubmitReviewPopoverOpen(false);
							setSubmitReviewBody("");
						}}
						onSubmit={handleSubmitReview}
						owner={owner}
						placeholder="Leave a comment with your review"
						repo={repo}
						submitLabel={
							submitReviewEvent === "APPROVE"
								? "Approve"
								: submitReviewEvent === "REQUEST_CHANGES"
									? "Request Changes"
									: "Comment"
						}
						value={submitReviewBody}
					/>
				</PopoverContent>
			</Popover>
			{dismissReviewMutation.isPending && (
				<p className="text-xs text-yellow-700 dark:text-yellow-500">
					Cancelling review...
				</p>
			)}
			{dismissReviewMutation.isError && (
				<p className="text-red-600 text-xs">
					Failed to cancel review. Please try again.
				</p>
			)}
			{submitReviewMutation.isError && (
				<p className="text-red-600 text-xs">
					Failed to submit review. Please try again.
				</p>
			)}
		</div>
	);

	const buttons = (pullRequest: PullsGetResponseData) => {
		const isDraft = !!pullRequest.draft && !markedReady;
		const isAuthor = currentUserLogin === pullRequest.user?.login;
		return (
			<>
				{reviewInProgress}
				<div className="flex gap-1">
					<button
						className="flex-1 cursor-pointer rounded-md bg-[#2da44e] px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-[#218838] disabled:cursor-not-allowed disabled:opacity-50"
						disabled={
							approveMutation.isPending ||
							approved ||
							isAuthor ||
							pendingReview != null
						}
						onClick={handleApprove}
						type="button"
					>
						{approveMutation.isPending
							? "Approving..."
							: approved
								? "Approved"
								: "Approve"}
					</button>
					{!approved && (
						<Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
							<PopoverTrigger asChild>
								<button
									className="cursor-pointer rounded-md bg-[#2da44e] px-2 py-2 text-white transition-colors hover:bg-[#218838] disabled:cursor-not-allowed disabled:opacity-50"
									disabled={
										approveMutation.isPending ||
										isAuthor ||
										pendingReview != null
									}
									type="button"
									title="Approve with comment"
								>
									<ChevronDown className="h-4 w-4" />
								</button>
							</PopoverTrigger>
							<PopoverContent
								align="end"
								className="w-[42rem] bg-white p-4 dark:bg-zinc-950"
								side="left"
								sideOffset={8}
							>
								<MarkdownEditor
									disabled={approveMutation.isPending}
									minHeight="150px"
									onChange={setApproveBody}
									onCancel={() => {
										setPopoverOpen(false);
										setApproveBody("");
									}}
									onSubmit={handleApproveWithComment}
									owner={owner}
									placeholder="Leave a comment with your approval"
									repo={repo}
									submitLabel="Approve"
									value={approveBody}
								/>
							</PopoverContent>
						</Popover>
					)}
				</div>
				<Popover
					open={requestChangesPopoverOpen}
					onOpenChange={setRequestChangesPopoverOpen}
				>
					<PopoverTrigger asChild>
						<button
							className="w-full cursor-pointer rounded-md bg-[#cf222e] px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-[#b91c23] disabled:cursor-not-allowed disabled:opacity-50"
							disabled={isAuthor || pendingReview != null}
							type="button"
						>
							Request Changes
						</button>
					</PopoverTrigger>
					<PopoverContent
						align="end"
						className="w-[42rem] bg-white p-4 dark:bg-zinc-950"
						side="left"
						sideOffset={8}
					>
						<MarkdownEditor
							disabled={requestChangesMutation.isPending}
							minHeight="150px"
							onChange={setRequestChangesBody}
							onCancel={() => {
								setRequestChangesPopoverOpen(false);
								setRequestChangesBody("");
							}}
							onSubmit={handleRequestChanges}
							owner={owner}
							placeholder="Describe your requested changes"
							repo={repo}
							submitLabel="Request Changes"
							value={requestChangesBody}
						/>
					</PopoverContent>
				</Popover>
				{isDraft ? (
					<button
						className="w-full cursor-pointer rounded-md bg-gray-200 px-3 py-2 font-medium text-gray-800 text-sm transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={markReadyMutation.isPending}
						onClick={handleMarkReady}
						type="button"
					>
						{markReadyMutation.isPending
							? "Marking..."
							: "Mark as ready for review"}
					</button>
				) : (
					<button
						className="w-full rounded-md bg-[#8250df] px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-[#6e40c9] disabled:opacity-50"
						disabled
						type="button"
					>
						Merge
					</button>
				)}
				{approveMutation.isError && (
					<p className="text-red-600 text-xs">
						Failed to approve. Please try again.
					</p>
				)}
				{requestChangesMutation.isError && (
					<p className="text-red-600 text-xs">
						Failed to request changes. Please try again.
					</p>
				)}
				{markReadyMutation.isError && (
					<p className="text-red-600 text-xs">
						Failed to mark as ready. Please try again.
					</p>
				)}
			</>
		);
	};

	return (
		<div className="sticky bottom-0 z-10 space-y-2 border-gray-200 border-t bg-white pt-6 pr-4 dark:border-zinc-800 dark:bg-zinc-950">
			{pullRequestPromise ? (
				<Async fallback={skeleton} promise={pullRequestPromise}>
					{(pullRequest) => buttons(pullRequest)}
				</Async>
			) : (
				skeleton
			)}
		</div>
	);
}

