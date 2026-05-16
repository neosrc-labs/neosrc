"use client";

import { Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Async } from "~/components/async";
import { UserHoverCard } from "~/components/user-hover-card";
import { cn } from "~/lib/utils";
import type { Assignee, PullsGetResponseData } from "~/server/github";
import { api } from "~/trpc/react";
import { FieldSkeleton } from "./metadata-section";

type AssigneeOperation = {
	id: number;
	op: "add" | "remove";
	assignee: Assignee;
};

export function AssigneeSection({
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
	const [operations, setOperations] = useState<AssigneeOperation[]>([]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: number identifies PR navigation, resets local state
	useEffect(() => {
		setOperations([]);
	}, [number]);

	const { data: repoAssignees } = api.pulls.listAssignees.useQuery({
		owner,
		repo,
	});
	const addMutation = api.pulls.addAssignee.useMutation();
	const removeMutation = api.pulls.removeAssignee.useMutation();

	const assigneesData = repoAssignees ?? [];
	const handleAdd = (assignee: Assignee) => {
		const repoAssignee = assigneesData.find((a) => a.login === assignee.login);
		if (!repoAssignee) return;

		const id = opId();
		setOperations((prev) => [...prev, { id, op: "add", assignee }]);
		addMutation.mutate(
			{ owner, repo, number, assignee: assignee.login },
			{
				onError: () => {
					setOperations((prev) => prev.filter((op) => op.id !== id));
				},
			},
		);
	};

	const handleRemove = (assignee: Assignee) => {
		const id = opId();
		setOperations((prev) => [...prev, { id, op: "remove", assignee }]);
		removeMutation.mutate(
			{ owner, repo, number, assignee: assignee.login },
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
					Assignees
				</h3>
				<Async promise={pullRequestPromise} fallback={null}>
					{(pullRequest) => (
						<AssigneeSectionSettings
							repoAssignees={assigneesData}
							assignees={pullRequest.assignees ?? []}
							operations={operations}
							onAddAssignee={handleAdd}
							onRemoveAssignee={handleRemove}
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
					<AssigneeSectionContent
						assignees={pullRequest.assignees ?? []}
						operations={operations}
						onRemoveAssignee={handleRemove}
					/>
				)}
			</Async>
		</>
	);
}

function AssigneeSectionSettings({
	repoAssignees,
	assignees,
	operations,
	onAddAssignee,
	onRemoveAssignee,
}: {
	repoAssignees: Assignee[];
	assignees: Assignee[];
	operations: AssigneeOperation[];
	onAddAssignee: (assignee: Assignee) => void;
	onRemoveAssignee: (assignee: Assignee) => void;
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

	const displayAssignees = applyOperations(assignees, operations);
	const currentLogins = new Set(displayAssignees.map((a) => a.login));
	const sortedAssignees = useRef<typeof repoAssignees>(null);
	if (open && repoAssignees && !sortedAssignees.current) {
		sortedAssignees.current = [...repoAssignees].sort((a, b) => {
			const aApplied = currentLogins.has(a.login) ? 0 : 1;
			const bApplied = currentLogins.has(b.login) ? 0 : 1;
			return aApplied - bApplied;
		});
	}
	if (!open) {
		sortedAssignees.current = null;
	}
	const filteredAssignees = (
		sortedAssignees.current ??
		repoAssignees ??
		[]
	).filter((a) => a.login.toLowerCase().includes(search.toLowerCase()));

	return (
		<div className="relative" ref={dropdownRef}>
			<button
				className="cursor-pointer rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"
				onClick={() => setOpen(!open)}
				type="button"
				aria-label="Manage assignees"
			>
				<Settings size={14} />
			</button>
			{open && (
				<div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
					<input
						className="w-full border-gray-200 border-b px-3 py-2 text-sm outline-none placeholder:text-gray-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Filter users"
						value={search}
					/>
					<ul className="max-h-60 overflow-y-auto py-1">
						{filteredAssignees.length === 0 ? (
							<li className="px-3 py-2 text-gray-400 text-xs">
								No users found
							</li>
						) : (
							filteredAssignees.map((assignee) => {
								const isApplied = currentLogins.has(assignee.login);
								return (
									<li
										className={cn(
											"flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-800",
											isApplied && "bg-blue-50 dark:bg-blue-950/30",
										)}
										key={assignee.login}
										onClick={() => {
											if (isApplied) {
												onRemoveAssignee(assignee);
											} else {
												onAddAssignee(assignee);
											}
										}}
										aria-selected={isApplied}
									>
										<img
											src={assignee.avatar_url}
											alt=""
											className="h-5 w-5 shrink-0 rounded-full"
										/>
										<span className="flex-1 truncate text-gray-700 dark:text-zinc-300">
											{assignee.login}
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

function AssigneeSectionContent({
	assignees,
	operations,
	onRemoveAssignee,
}: {
	assignees: Assignee[];
	operations: AssigneeOperation[];
	onRemoveAssignee: (assignee: Assignee) => void;
}) {
	const displayAssignees = applyOperations(assignees, operations);

	if (displayAssignees.length === 0) {
		return (
			<p className="text-gray-500 text-sm dark:text-zinc-400">No assignees</p>
		);
	}

	return (
		<ul className="space-y-2">
			{displayAssignees.map((assignee) => (
				<li
					className="group flex items-center gap-2 text-sm"
					key={assignee.login}
				>
					<UserHoverCard login={assignee.login}>
						<a className="flex items-center gap-2" href={assignee.html_url}>
							<img
								alt={assignee.login}
								className="h-5 w-5 rounded-full"
								src={assignee.avatar_url}
							/>
							<span className="text-gray-600 dark:text-zinc-400">
								{assignee.login}
							</span>
						</a>
					</UserHoverCard>
					<button
						className="ml-auto inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded text-gray-400 opacity-0 hover:text-gray-600 group-hover:opacity-100 dark:hover:text-zinc-300"
						onClick={() => onRemoveAssignee(assignee)}
						type="button"
						aria-label={`Remove ${assignee.login}`}
					>
						&times;
					</button>
				</li>
			))}
		</ul>
	);
}

function applyOperations(
	assignees: Assignee[],
	operations: AssigneeOperation[],
): Assignee[] {
	let updatedAssignees = [...assignees];

	for (const op of operations) {
		if (
			op.op === "add" &&
			!updatedAssignees.some((a) => a.login === op.assignee.login)
		) {
			updatedAssignees.push(op.assignee);
		}
		if (op.op === "remove") {
			updatedAssignees = updatedAssignees.filter(
				(a) => a.login !== op.assignee.login,
			);
		}
	}

	return updatedAssignees;
}

function opId() {
	return Math.floor(Math.random() * 10000000);
}
