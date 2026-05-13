"use client";

import { ChevronDown, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { use, useCallback, useMemo, useState } from "react";
import { Async } from "~/components/async";
import { CheckHoverCard } from "~/components/check-hover-card";
import { MarkdownEditor } from "~/components/markdown/MarkdownEditor";
import { NavItem, NavMenu } from "~/components/ui/nav-menu";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
import { useFiles } from "~/hooks/files";
import type { CheckRun, PullsGetResponseData } from "~/server/github";
import { api } from "~/trpc/react";
import { buildFileTree, FileTree, FileTreeSkeleton } from "./file-tree";

interface LeftSidebarContentSectionProps {
	owner: string;
	repo: string;
	number: number;
	checksPromise: Promise<Array<CheckRun>> | null;
	pullRequestPromise: Promise<PullsGetResponseData> | null;
}

export function LeftSidebarContentSection({
	owner,
	repo,
	number,
	checksPromise,
	pullRequestPromise,
}: LeftSidebarContentSectionProps) {
	const pathname = usePathname();
	const basePath = `/${owner}/${repo}/pull/${number}`;
	const isFilesActive =
		pathname === `${basePath}/changes` ||
		pathname.startsWith(`${basePath}/changes/`);

	return isFilesActive ? (
		<SidebarFileTree
			number={number}
			owner={owner}
			pullRequestPromise={pullRequestPromise}
			repo={repo}
		/>
	) : (
		<Checks checksPromise={checksPromise!} />
	);
}

interface SidebarFileTreeProps {
	owner: string;
	repo: string;
	number: number;
	pullRequestPromise: Promise<PullsGetResponseData> | null;
}

export function SidebarFileTree({
	owner,
	repo,
	number,
	pullRequestPromise,
}: SidebarFileTreeProps) {
	const pathname = usePathname();
	const basePath = `/${owner}/${repo}/pull/${number}`;
	// Extract commit SHA from pathname if present
	const commitSha = useMemo(() => {
		const match = pathname?.match(/\/changes\/([a-f0-9]{7,40})/);
		return match ? match[1] : undefined;
	}, [pathname]);

	const pullRequest = use(pullRequestPromise ?? Promise.resolve(null));
	const { files, isLoading } = useFiles({ owner, repo, number, commitSha });

	const fileTree = useMemo(() => buildFileTree(files), [files]);

	const filesChanged = commitSha ? files.length : pullRequest?.changed_files;

	return (
		<>
			<h3 className="mb-2 font-semibold text-gray-900 text-sm dark:text-zinc-100">
				Files Changed {filesChanged ? <span>({filesChanged})</span> : <></>}
			</h3>
			{isLoading ? (
				<FileTreeSkeleton />
			) : files.length > 0 ? (
				<FileTree basePath={basePath} files={fileTree} />
			) : (
				<p className="text-gray-500 text-sm dark:text-zinc-400">
					No files changed
				</p>
			)}
		</>
	);
}

interface SidebarNavMenuProps {
	owner: string;
	repo: string;
	number: number;
}

export function SidebarNavMenu({ owner, repo, number }: SidebarNavMenuProps) {
	const pathname = usePathname();
	const basePath = `/${owner}/${repo}/pull/${number}`;
	const isFilesActive =
		pathname === `${basePath}/changes` ||
		pathname.startsWith(`${basePath}/changes/`);
	return (
		<NavMenu>
			<NavItem href={basePath} isActive={!isFilesActive} label="Conversation" />
			<NavItem
				href={`${basePath}/changes`}
				isActive={isFilesActive}
				label="Files Changed"
			/>
		</NavMenu>
	);
}

interface ChecksProps {
	checksPromise: Promise<Array<CheckRun>>;
}

interface SidebarActionButtonsProps {
	owner: string;
	repo: string;
	number: number;
	pullRequestPromise: Promise<PullsGetResponseData> | null;
	currentUserLogin?: string;
}

export function SidebarActionButtons({
	owner,
	repo,
	number,
	pullRequestPromise,
	currentUserLogin,
}: SidebarActionButtonsProps) {
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
									className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 font-medium text-xs transition-colors ${
										submitReviewEvent === event
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

function Checks({ checksPromise }: ChecksProps) {
	const checks = use(checksPromise);
	return (
		<>
			<h3 className="mb-2 font-semibold text-gray-900 text-sm dark:text-zinc-100">
				Checks
			</h3>
			{checks && checks.length > 0 ? (
				<div className="max-h-full space-y-2 overflow-y-auto">
					{checks.map((check) => (
						<CheckHoverCard check={check} key={check.html_url ?? check.name}>
							<a
								className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800"
								href={check.html_url}
								rel="noopener noreferrer"
								target="_blank"
							>
								<span className="text-sm">
									{check.conclusion === "success" ? (
										<span className="text-green-600">✓</span>
									) : check.conclusion === "failure" ? (
										<span className="text-red-600">✗</span>
									) : check.status === "in_progress" ? (
										<span className="text-gray-400">⏳</span>
									) : (
										<span className="text-gray-400">○</span>
									)}
								</span>
								<span className="truncate text-gray-700 text-sm dark:text-zinc-300">
									{check.name}
								</span>
							</a>
						</CheckHoverCard>
					))}
				</div>
			) : (
				<p className="text-gray-500 text-sm dark:text-zinc-400">No checks</p>
			)}
		</>
	);
}
