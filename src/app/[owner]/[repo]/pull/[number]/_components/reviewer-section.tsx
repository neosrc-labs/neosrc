"use client";

import { Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Async } from "~/components/async";
import { UserHoverCard } from "~/components/user-hover-card";
import { cn } from "~/lib/utils";
import type {
	PullsGetResponseData,
	Reviewer,
} from "~/server/github";
import { api } from "~/trpc/react";
import { FieldSkeleton } from "./metadata-section";

type ReviewerOperation = { id: number, op: 'add' | 'remove', reviewer: Reviewer };

export function ReviewerSection({
	pullRequestPromise,
	owner,
	repo,
	number,
}: {
	pullRequestPromise: Promise<PullsGetResponseData>;
	owner: string;
	repo: string;
	number: number;
}) {
	const [operations, setOperations] = useState<ReviewerOperation[]>([]);

	useEffect(() => {
		setOperations([]);
	}, [pullRequestPromise])

	const { data: repoUsers } = api.pulls.listAssignees.useQuery({ owner, repo });
	const addMutation = api.pulls.addReviewer.useMutation();
	const removeMutation = api.pulls.removeReviewer.useMutation();

	const usersData = repoUsers ?? [];
	const handleAdd = (reviewer: Reviewer) => {
		const repoUser = usersData.find((u) => u.login === reviewer.login);
		if (!repoUser) return;

		const id = opId()
		setOperations(prev => [...prev, { id, op: 'add', reviewer }])
		addMutation.mutate({ owner, repo, number, reviewer: reviewer.login }, {
			onError: () => {
				setOperations(prev => prev.filter(op => op.id !== id))
			}
		});
	};

	const handleRemove = (reviewer: Reviewer) => {
		const id = opId()
		setOperations(prev => [...prev, { id, op: 'remove', reviewer }])
		removeMutation.mutate({ owner, repo, number, reviewer: reviewer.login }, {
			onError: () => {
				setOperations(prev => prev.filter(op => op.id !== id))
			}
		});
	};

	return (
		<>
			<div className="flex items-start justify-between">
				<h3 className="font-semibold text-gray-900 text-sm dark:text-zinc-100">
					Reviewers
				</h3>
				<Async promise={pullRequestPromise} fallback={null}>
					{(pullRequest) => (
						<ReviewerSectionSettings
							repoUsers={usersData.filter((u) => u.login !== pullRequest.user?.login)}
							reviewers={pullRequest.requested_reviewers ?? []}
							operations={operations}
							onAddReviewer={handleAdd}
							onRemoveReviewer={handleRemove}
						/>
					)}
				</Async>
			</div>
			<Async promise={pullRequestPromise} fallback={<div className="mt-2"><FieldSkeleton /></div>}>
				{(pullRequest) => (
					<ReviewerSectionContent
						reviewers={pullRequest.requested_reviewers ?? []}
						operations={operations}
						onRemoveReviewer={handleRemove}
					/>
				)}
			</Async>
		</>
	);
}

function ReviewerSectionSettings({ repoUsers, reviewers, operations, onAddReviewer, onRemoveReviewer }: {
	repoUsers: Reviewer[],
	reviewers: Reviewer[],
	operations: ReviewerOperation[],
	onAddReviewer: (reviewer: Reviewer) => void,
	onRemoveReviewer: (reviewer: Reviewer) => void,
}) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const dropdownRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const handler = (e: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(e.target as Node)
			) {
				setOpen(false);
				setSearch("");
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	const displayReviewers = applyOperations(reviewers, operations);
	const currentLogins = new Set(displayReviewers.map((r) => r.login));
	const sortedUsers = useRef<typeof repoUsers>(null);
	if (open && repoUsers && !sortedUsers.current) {
		sortedUsers.current = [...repoUsers].sort((a, b) => {
			const aApplied = currentLogins.has(a.login) ? 0 : 1;
			const bApplied = currentLogins.has(b.login) ? 0 : 1;
			return aApplied - bApplied;
		});
	}
	if (!open) {
		sortedUsers.current = null;
	}
	const filteredUsers = (sortedUsers.current ?? repoUsers ?? []).filter(
		(u) => u.login.toLowerCase().includes(search.toLowerCase()),
	);

	return (
		<div className="relative" ref={dropdownRef}>
			<button
				className="cursor-pointer rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"
				onClick={() => setOpen(!open)}
				type="button"
				aria-label="Manage reviewers"
			>
				<Settings size={14} />
			</button>
			{open && (
				<div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
					<input
						autoFocus
						className="w-full border-gray-200 border-b px-3 py-2 text-sm outline-none placeholder:text-gray-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Filter users"
						value={search}
					/>
					<ul className="max-h-60 overflow-y-auto py-1">
						{filteredUsers.length === 0 ? (
							<li className="px-3 py-2 text-gray-400 text-xs">
								No users found
							</li>
						) : (
							filteredUsers.map((user) => {
								const isApplied = currentLogins.has(user.login);
								return (
									<li
										className={cn(
											"flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-800",
											isApplied && "bg-blue-50 dark:bg-blue-950/30",
										)}
										key={user.login}
										onClick={() => {
											if (isApplied) {
												onRemoveReviewer(user);
											} else {
												onAddReviewer(user);
											}
										}}
										role="option"
										aria-selected={isApplied}
									>
										<img src={user.avatar_url} alt="" className="h-5 w-5 shrink-0 rounded-full" />
										<span className="flex-1 truncate text-gray-700 dark:text-zinc-300">
											{user.login}
										</span>
										{isApplied && (
											<span className="shrink-0 text-blue-600 text-xs dark:text-blue-400">
												&#10003;
											</span>
										)}
									</li>
								);
							})
						)}
					</ul>
				</div>
			)}
		</div>
	);
}

function ReviewerSectionContent({
	reviewers,
	operations,
	onRemoveReviewer,
}: {
	reviewers: Reviewer[],
	operations: ReviewerOperation[],
	onRemoveReviewer: (reviewer: Reviewer) => void,
}) {
	const displayReviewers = applyOperations(reviewers, operations);

	if (displayReviewers.length === 0) {
		return (
			<p className="text-gray-500 text-sm dark:text-zinc-400">
				No reviewers
			</p>
		);
	}

	return (
		<ul className="space-y-2">
			{displayReviewers.map((reviewer) => (
				<li className="group flex items-center gap-2 text-sm" key={reviewer.login}>
					<UserHoverCard login={reviewer.login}>
						<a
							className="flex items-center gap-2"
							href={reviewer.html_url}
						>
							<img
								alt={reviewer.login}
								className="h-5 w-5 rounded-full"
								src={reviewer.avatar_url}
							/>
							<span className="text-gray-600 dark:text-zinc-400">
								{reviewer.login}
							</span>
						</a>
					</UserHoverCard>
					<button
						className="ml-auto inline-flex h-4 w-4 items-center justify-center rounded text-gray-400 opacity-0 hover:text-gray-600 group-hover:opacity-100 dark:hover:text-zinc-300 cursor-pointer"
						onClick={() => onRemoveReviewer(reviewer)}
						type="button"
						aria-label={`Remove ${reviewer.login}`}
					>
						&times;
					</button>
				</li>
			))}
		</ul>
	);
}

function applyOperations(reviewers: Reviewer[], operations: ReviewerOperation[]): Reviewer[] {
	let updatedReviewers = [...reviewers];

	for (const op of operations) {
		if (op.op === 'add' && !updatedReviewers.some(r => r.login === op.reviewer.login)) {
			updatedReviewers.push(op.reviewer);
		}
		if (op.op === 'remove') {
			updatedReviewers = updatedReviewers.filter(r => r.login !== op.reviewer.login)
		}
	}

	return updatedReviewers
}

function opId() {
	return Math.floor(Math.random() * 10000000);
}
