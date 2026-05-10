"use client";

import NextLink from "next/link";
import { useCallback, useState } from "react";
import { Async } from "~/components/async";
import { MarkdownEditor } from "~/components/markdown/MarkdownEditor";
import { MarkdownRenderer } from "~/components/markdown/MarkdownRenderer";
import { Reactions } from "~/components/Reactions";
import { extractPullRequestState, StatusPill } from "~/components/ui/status-pill";
import { UserHoverCard } from "~/components/user-hover-card";
import type { PullsGetResponseData } from "~/server/github";
import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/utils";

interface PullRequestDescriptionSectionProps {
	owner: string;
	repo: string;
	number: number;
	pullRequestPromise: Promise<PullsGetResponseData>;
}

export function PullRequestDescriptionSection({
	owner,
	repo,
	number,
	pullRequestPromise,
}: PullRequestDescriptionSectionProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editBody, setEditBody] = useState("");
	const [savedBody, setSavedBody] = useState<string | null>(null);

	const updateMutation = api.pulls.updateBody.useMutation();

	const handleStartEdit = useCallback((currentBody: string) => {
		setEditBody(currentBody);
		setIsEditing(true);
	}, []);

	const handleCancel = useCallback(() => {
		setIsEditing(false);
		setEditBody("");
	}, []);

	const handleSave = useCallback(async () => {
		try {
			await updateMutation.mutateAsync({ owner, repo, number, body: editBody });
			setSavedBody(editBody);
			setIsEditing(false);
		} catch {
			// TODO: Show error toast
		}
	}, [editBody, owner, repo, number, updateMutation]);

	return (
		<div>
			{/* PR Header */}
			<div className="mb-6">
				<div className="mb-2 flex items-center gap-2">
					<Async
						fallback={
							<div className="h-5 w-16 animate-pulse rounded-full bg-gray-200 dark:bg-zinc-700" />
						}
						promise={pullRequestPromise}
					>
						{(pullRequest) => {
							const state = extractPullRequestState(pullRequest);
							return (
								<StatusPill state={state} />
							);
						}}
					</Async>
					<Async
						fallback={
							<div className="h-8 w-96 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
						}
						promise={pullRequestPromise}
					>
						{(pullRequest) => (
							<h1 className="font-bold text-2xl text-gray-900 dark:text-zinc-100">
								{pullRequest.title}
							</h1>
						)}
					</Async>
					<h1 className="text-2xl text-gray-400 dark:text-zinc-500">
						#{number}
					</h1>
				</div>

				<Async
					fallback={
						<div className="h-5 w-104 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
					}
					promise={pullRequestPromise}
				>
					{(pullRequest) => (
						<div className="mt-2 flex items-center gap-2">
							<div className="text-gray-600 text-sm dark:text-zinc-400">
								<span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-700">
									{pullRequest.base.ref}
								</span>
								<span className="mx-2">←</span>
								<span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
									{pullRequest.head.ref}
								</span>
							</div>
							<div className="flex items-center gap-2 text-gray-600 text-sm dark:text-zinc-400">
								opened by{" "}
								<UserHoverCard login={pullRequest.user.login}>
									<NextLink
										className="flex items-center gap-2"
										href={pullRequest.user.html_url}
									>
										<img
											alt={pullRequest.user?.login}
											className="h-5 w-5 rounded-full"
											src={pullRequest.user?.avatar_url}
										/>
										{pullRequest.user?.login}{" "}
									</NextLink>
								</UserHoverCard>
								{formatRelativeTime(pullRequest.created_at)}
							</div>
						</div>
					)}
				</Async>
			</div>

			<div className="mt-4 border-gray-200 border-t pt-4 dark:border-zinc-700" />

			<Async
				fallback={
					<div className="h-48 w-fill animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
				}
				promise={pullRequestPromise}
			>
				{(pullRequest) => {
					const displayBody = savedBody ?? pullRequest.body;
					return (
						<>
							{/* PR Description */}
							<div className="rounded-lg border border-gray-200 bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900">
								<div className="flex items-center justify-between border-gray-200 border-b px-4 py-1 dark:border-zinc-700">
									<h3 className="font-semibold text-gray-700 text-sm dark:text-zinc-300">
										Description
									</h3>
									{!isEditing && (
										<button
											className="cursor-pointer text-blue-600 text-sm hover:text-blue-800"
											onClick={() => handleStartEdit(pullRequest.body ?? "")}
											type="button"
										>
											Edit
										</button>
									)}
								</div>
								<div className="p-4">
									{isEditing ? (
										<MarkdownEditor
											onCancel={handleCancel}
											onChange={setEditBody}
											onSubmit={handleSave}
											submitLabel="Save"
											value={editBody}
											owner={owner}
											repo={repo}
										/>
									) : (
										<div className="prose prose-sm max-w-none">
											{displayBody ? (
												<MarkdownRenderer
													content={displayBody}
													owner={owner}
													repo={repo}
												/>
											) : (
												<p className="text-gray-500 italic dark:text-zinc-400">
													No description provided.
												</p>
											)}
										</div>
									)}
								</div>
							</div>
						</>
					);
				}}
			</Async>

			{/* Reactions */}
			<Reactions number={number} owner={owner} repo={repo} />
		</div>
	);
}
