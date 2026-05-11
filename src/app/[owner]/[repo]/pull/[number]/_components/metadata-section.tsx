"use client";

import { Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Async } from "~/components/async";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "~/components/ui/hover-card";
import { Label as LabelComponent } from "~/components/ui/label";
import { UserHoverCard } from "~/components/user-hover-card";
import { cn } from "~/lib/utils";
import type {
	Assignee,
	Label,
	PullsGetResponseData,
	Reviewer,
} from "~/server/github";
import { api } from "~/trpc/react";

interface MetadataSectionProps {
	pullRequestPromise: Promise<PullsGetResponseData>;
	owner: string;
	repo: string;
	number: number;
}

export function MetadataSection({
	pullRequestPromise,
	owner,
	repo,
	number,
}: MetadataSectionProps) {
	return (
		<>
			{/* Reviewers Section */}
			<section>
				<h3 className="mb-2 font-semibold text-gray-900 text-sm dark:text-zinc-100">
					Reviewers
				</h3>

				<Async promise={pullRequestPromise} fallback={<FieldSkeleton />}>
					{(pullRequest) =>
						pullRequest.requested_reviewers &&
							pullRequest.requested_reviewers.length > 0 ? (
							<ul className="space-y-2">
								{pullRequest.requested_reviewers.map((reviewer: Reviewer) => (
									<li
										className="flex items-center gap-2 text-sm"
										key={reviewer.login}
									>
										<img
											alt={reviewer.login}
											className="h-5 w-5 rounded-full"
											src={reviewer.avatar_url}
										/>
										<span className="text-gray-600 dark:text-zinc-400">
											{reviewer.login}
										</span>
									</li>
								))}
							</ul>
						) : (
							<p className="text-gray-500 text-sm dark:text-zinc-400">
								No reviewers
							</p>
						)
					}
				</Async>
			</section>

			{/* Assignees Section */}
			<section>
				<h3 className="mb-2 font-semibold text-gray-900 text-sm dark:text-zinc-100">
					Assignees
				</h3>
				<Async promise={pullRequestPromise} fallback={<FieldSkeleton />}>
					{(pullRequest) =>
						pullRequest.assignees && pullRequest.assignees.length > 0 ? (
							<ul className="space-y-2">
								{pullRequest.assignees.map((assignee: Assignee) => (
									<UserHoverCard login={assignee.login}>
										<a
											className="flex items-center gap-2"
											href={assignee.html_url}
										>
											<li
												className="flex items-center gap-2 text-sm"
												key={assignee.login}
											>
												<img
													alt={assignee.login}
													className="h-5 w-5 rounded-full"
													src={assignee.avatar_url}
												/>
												<span className="text-gray-600 dark:text-zinc-400">
													{assignee.login}
												</span>
											</li>
										</a>
									</UserHoverCard>
								))}
							</ul>
						) : (
							<p className="text-gray-500 text-sm dark:text-zinc-400">
								No assignees
							</p>
						)
					}
				</Async>
			</section>

			{/* Milestone Section */}
			<section>
				<h3 className="mb-2 font-semibold text-gray-900 text-sm dark:text-zinc-100">
					Milestone
				</h3>
				<Async promise={pullRequestPromise} fallback={<FieldSkeleton />}>
					{(pullRequest) =>
						pullRequest.milestone ? (
							<p className="text-gray-600 text-sm dark:text-zinc-400">
								{pullRequest.milestone.title}
							</p>
						) : (
							<p className="text-gray-500 text-sm dark:text-zinc-400">
								No milestone
							</p>
						)
					}
				</Async>
			</section>

			{/* Labels Section */}
			<section className="min-h-30">
				<LabelsSection
					pullRequestPromise={pullRequestPromise}
					owner={owner}
					repo={repo}
					number={number}
				/>
			</section>
		</>
	);
}

function FieldSkeleton() {
	return (
		<section>
			<div className="mb-3 h-5 w-24 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
		</section>
	);
}

function LabelsSection({
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
	const [labels, setLabels] = useState<Label[]>([]);
	const initialLabelsRef = useRef<Label[]>([]);
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const dropdownRef = useRef<HTMLDivElement>(null);

	const { data: repoLabels } = api.pulls.listLabels.useQuery(
		{ owner, repo },
		{ enabled: open },
	);

	const utils = api.useUtils();
	const addMutation = api.pulls.addLabel.useMutation({
		onSuccess: () => {
			utils.pulls.listLabels.invalidate();
		},
	});
	const removeMutation = api.pulls.removeLabel.useMutation();

	const currentNames = new Set(labels.map((l) => l.name));
	const sortedLabels = useRef<typeof repoLabels>(null);
	if (open && repoLabels && !sortedLabels.current) {
		sortedLabels.current = [...repoLabels].sort((a, b) => {
			const aApplied = currentNames.has(a.name) ? 0 : 1;
			const bApplied = currentNames.has(b.name) ? 0 : 1;
			return aApplied - bApplied;
		});
	}
	if (!open) {
		sortedLabels.current = null;
	}
	const filteredLabels = (sortedLabels.current ?? repoLabels ?? []).filter(
		(l) => l.name.toLowerCase().includes(search.toLowerCase()),
	);

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

	const labelsData = repoLabels ?? [];
	const handleAdd = (name: string) => {
		const repoLabel = labelsData.find((l) => l.name === name);
		if (!repoLabel) return;
		setLabels((prev) => [...prev, repoLabel as Label]);
		addMutation.mutate(
			{ owner, repo, number, label: name },
			{ onError: () => setLabels(initialLabelsRef.current) },
		);
	};

	const handleRemove = (name: string) => {
		setLabels((prev) => prev.filter((l) => l.name !== name));
		removeMutation.mutate(
			{ owner, repo, number, label: name },
			{ onError: () => setLabels(initialLabelsRef.current) },
		);
	};

	return (
		<>
			<div className="flex items-start justify-between">
				<h3 className="font-semibold text-gray-900 text-sm dark:text-zinc-100">
					Labels
				</h3>
				<Async promise={pullRequestPromise} fallback={null}>
					{() => (
						<div className="relative" ref={dropdownRef}>
							<button
								className="cursor-pointer rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"
								onClick={() => setOpen(!open)}
								type="button"
								aria-label="Manage labels"
							>
								<Settings size={14} />
							</button>
							{open && (
								<div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
									<input
										autoFocus
										className="w-full border-gray-200 border-b px-3 py-2 text-sm outline-none placeholder:text-gray-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
										onChange={(e) => setSearch(e.target.value)}
										placeholder="Filter labels"
										value={search}
									/>
									<ul className="max-h-60 overflow-y-auto py-1">
										{filteredLabels.length === 0 ? (
											<li className="px-3 py-2 text-gray-400 text-xs">
												No labels found
											</li>
										) : (
											filteredLabels.map((label) => {
												const isApplied = currentNames.has(label.name);
												return (
													<li
														className={cn(
															"flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-800",
															isApplied && "bg-blue-50 dark:bg-blue-950/30",
														)}
														key={label.name}
														onClick={() => {
															if (isApplied) {
																handleRemove(label.name);
															} else {
																handleAdd(label.name);
															}
														}}
														role="option"
														aria-selected={isApplied}
													>
														<div className="flex min-w-0 flex-1 flex-col gap-0.5">
															<div className="flex items-center gap-2">
																<LabelComponent color={label.color}>
																	{label.name}
																</LabelComponent>
																{isApplied && (
																	<span className="shrink-0 text-blue-600 text-xs dark:text-blue-400">
																		&#10003;
																	</span>
																)}
															</div>
															{label.description && (
																<span className="truncate text-gray-400 text-xs">
																	{label.description}
																</span>
															)}
														</div>
													</li>
												);
											})
										)}
									</ul>
								</div>
							)}
						</div>
					)}
				</Async>
			</div>
			<Async promise={pullRequestPromise} fallback={<div className="mt-2"><FieldSkeleton /></div>}>
				{(pullRequest) => {
					if (initialLabelsRef.current.length === 0) {
						initialLabelsRef.current = pullRequest.labels ?? [];
						setLabels(pullRequest.labels ?? []);
					}
					const displayLabels =
						labels.length > 0 ? labels : initialLabelsRef.current;
					return displayLabels.length > 0 ? (
						<div className="flex flex-wrap gap-1.5">
							{displayLabels.map((label) => (
								<div key={label.name}>
									<LabelComponent color={label.color}>
										{label.name}
										<button
											className="-mr-0.5 ml-0.5 inline-flex h-3 w-3 items-center justify-center rounded-full text-current opacity-60 hover:opacity-100 text-lg cursor-pointer"
											onClick={() => handleRemove(label.name)}
											type="button"
											aria-label={`Remove label ${label.name}`}
										>
											&times;
										</button>
									</LabelComponent>
								</div>
							))}
						</div>
					) : (
						<p className="text-gray-500 text-sm dark:text-zinc-400">
							No labels
						</p>
					);
				}}
			</Async>
		</>
	);
}
