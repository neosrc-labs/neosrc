"use client";

import { usePathname } from "next/navigation";
import { use, useCallback, useMemo, useState } from "react";
import { useFiles } from "~/hooks/files";
import type { PullsGetResponseData } from "~/server/github";
import { api } from "~/trpc/react";
import { buildFileTree, FileTree, FileTreeSkeleton } from "./file-tree";
import {
	NavItem,
	NavMenu,
} from "~/components/ui/nav-menu"

interface LeftSidebarContentSectionProps {
	owner: string;
	repo: string;
	number: number;
	checksPromise: Promise<
		Array<{
			name: string;
			conclusion: string | null;
			status: string;
			html_url?: string;
		}>
	> | null;
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
	checksPromise: Promise<
		Array<{
			name: string;
			conclusion: string | null;
			status: string;
			html_url?: string;
		}>
	>;
}

interface SidebarActionButtonsProps {
	owner: string;
	repo: string;
	number: number;
}

export function SidebarActionButtons({
	owner,
	repo,
	number,
}: SidebarActionButtonsProps) {
	const [approved, setApproved] = useState(false);

	const approveMutation = api.pulls.approve.useMutation({
		onSuccess: () => setApproved(true),
	});

	const handleApprove = useCallback(() => {
		approveMutation.mutate({ owner, repo, number, event: "APPROVE" });
	}, [owner, repo, number, approveMutation]);

	// TODO: Disable approve button based on if the user is allowed to approve this PR
	return (
		<div className="sticky bottom-0 z-10 space-y-2 border-gray-200 border-t bg-white pt-6 pr-4 dark:border-zinc-800 dark:bg-zinc-950">
			<button
				className="w-full cursor-pointer rounded-md bg-[#2da44e] px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-[#218838] disabled:cursor-not-allowed disabled:opacity-50"
				disabled={approveMutation.isPending || approved}
				onClick={handleApprove}
				type="button"
			>
				{approveMutation.isPending
					? "Approving..."
					: approved
						? "Approved"
						: "Approve"}
			</button>
			<button
				className="w-full rounded-md bg-[#cf222e] px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-[#b91c23] disabled:opacity-50"
				disabled
				type="button"
			>
				Request Changes
			</button>
			<button
				className="w-full rounded-md bg-[#8250df] px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-[#6e40c9] disabled:opacity-50"
				disabled
				type="button"
			>
				Merge
			</button>
			{approveMutation.isError && (
				<p className="text-red-600 text-xs">
					Failed to approve. Please try again.
				</p>
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
						<a
							className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800"
							href={check.html_url}
							key={check.html_url ?? check.name}
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
					))}
				</div>
			) : (
				<p className="text-gray-500 text-sm dark:text-zinc-400">No checks</p>
			)}
		</>
	);
}
