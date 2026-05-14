"use client";

import { Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Async } from "~/components/async";
import { cn } from "~/lib/utils";
import type { Milestone, PullsGetResponseData } from "~/server/github";
import { api } from "~/trpc/react";
import { FieldSkeleton } from "./metadata-section";

type MilestoneOperation = { id: number; milestone: Milestone | null };

export function MilestoneSection({
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
	const [operations, setOperations] = useState<MilestoneOperation[]>([]);

	useEffect(() => {
		setOperations([]);
	}, [pullRequestPromise]);

	const { data: repoMilestones } = api.pulls.listMilestones.useQuery({
		owner,
		repo,
	});
	const setMutation = api.pulls.setMilestone.useMutation();

	const milestonesData = (repoMilestones ?? []) as Milestone[];
	const handleSet = (milestone: Milestone | null) => {
		const id = opId();
		setOperations((prev) => [...prev, { id, milestone }]);
		setMutation.mutate(
			{ owner, repo, number, milestone: milestone?.number ?? null },
			{
				onError: () => {
					setOperations((prev) => prev.filter((op) => op.id !== id));
				},
			},
		);
	};

	return (
		<>
			<div className="flex items-start justify-between">
				<h3 className="font-semibold text-gray-900 text-sm dark:text-zinc-100">
					Milestone
				</h3>
				<Async promise={pullRequestPromise} fallback={null}>
					{(pullRequest) => (
						<MilestoneSectionSettings
							repoMilestones={milestonesData}
							milestone={pullRequest.milestone}
							operations={operations}
							onSetMilestone={handleSet}
						/>
					)}
				</Async>
			</div>
			<Async
				promise={pullRequestPromise}
				fallback={
					<div className="mt-2">
						<FieldSkeleton />
					</div>
				}
			>
				{(pullRequest) => (
					<MilestoneSectionContent
						milestone={pullRequest.milestone}
						operations={operations}
					/>
				)}
			</Async>
		</>
	);
}

function MilestoneSectionSettings({
	repoMilestones,
	milestone,
	operations,
	onSetMilestone,
}: {
	repoMilestones: Milestone[];
	milestone: Milestone | null;
	operations: MilestoneOperation[];
	onSetMilestone: (milestone: Milestone | null) => void;
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

	const currentMilestone = applyOperations(milestone, operations);
	const currentNumber = currentMilestone?.number ?? null;

	const filteredMilestones = repoMilestones.filter((m) =>
		m.title.toLowerCase().includes(search.toLowerCase()),
	);

	return (
		<div className="relative" ref={dropdownRef}>
			<button
				className="cursor-pointer rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"
				onClick={() => setOpen(!open)}
				type="button"
				aria-label="Manage milestone"
			>
				<Settings size={14} />
			</button>
			{open && (
				<div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
					<input
						autoFocus
						className="w-full border-gray-200 border-b px-3 py-2 text-sm outline-none placeholder:text-gray-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Filter milestones"
						value={search}
					/>
					<ul className="max-h-60 overflow-y-auto py-1">
						<li
							className={cn(
								"flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-800",
								currentNumber === null && "bg-blue-50 dark:bg-blue-950/30",
							)}
							onClick={() => {
								if (currentNumber !== null) {
									onSetMilestone(null);
								}
							}}
							role="option"
							aria-selected={currentNumber === null}
						>
							<span className="flex-1 text-gray-500 italic dark:text-zinc-400">
								No milestone
							</span>
							{currentNumber === null && (
								<span className="shrink-0 text-blue-600 text-xs dark:text-blue-400">
									&#10003;
								</span>
							)}
						</li>
						{filteredMilestones.length === 0 ? (
							<li className="px-3 py-2 text-gray-400 text-xs">
								No milestones found
							</li>
						) : (
							filteredMilestones.map((m) => {
								const isSelected = currentNumber === m.number;
								return (
									<li
										className={cn(
											"flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-800",
											isSelected && "bg-blue-50 dark:bg-blue-950/30",
										)}
										key={m.number}
										onClick={() => {
											if (!isSelected) {
												onSetMilestone(m);
											}
										}}
										role="option"
										aria-selected={isSelected}
									>
										<div className="flex min-w-0 flex-1 flex-col gap-0.5">
											<span className="truncate text-gray-700 dark:text-zinc-300">
												{m.title}
											</span>
											{m.description && (
												<span className="truncate text-gray-400 text-xs">
													{m.description}
												</span>
											)}
										</div>
										{isSelected && (
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

function MilestoneSectionContent({
	milestone,
	operations,
}: {
	milestone: Milestone | null;
	operations: MilestoneOperation[];
}) {
	const currentMilestone = applyOperations(milestone, operations);

	if (!currentMilestone) {
		return (
			<p className="text-gray-500 text-sm dark:text-zinc-400">No milestone</p>
		);
	}

	return (
		<a
			className="text-gray-600 text-sm hover:underline dark:text-zinc-400"
			href={currentMilestone.html_url}
			target="_blank"
			rel="noreferrer"
		>
			{currentMilestone.title}
		</a>
	);
}

function applyOperations(
	milestone: Milestone | null,
	operations: MilestoneOperation[],
): Milestone | null {
	let updatedMilestone = milestone;
	for (const op of operations) {
		updatedMilestone = op.milestone;
	}
	return updatedMilestone;
}

function opId() {
	return Math.floor(Math.random() * 10000000);
}
