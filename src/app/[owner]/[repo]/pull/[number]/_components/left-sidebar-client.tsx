"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { use, useMemo } from "react";
import { useFiles } from "~/hooks/files";
import type { PullsGetResponseData } from "~/server/github";
import { buildFileTree, FileTree, FileTreeSkeleton } from "./file-tree";

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
			<h3 className="mb-2 font-semibold text-gray-900 text-sm">
				Files Changed {filesChanged ? <span>({filesChanged})</span> : <></>}
			</h3>
			{isLoading ? (
				<FileTreeSkeleton />
			) : files.length > 0 ? (
				<FileTree basePath={basePath} files={fileTree} />
			) : (
				<p className="text-gray-500 text-sm">No files changed</p>
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
		<nav className="sticky top-0 z-10 space-y-1 bg-white pr-4 pb-4">
			<NavItem href={basePath} isActive={!isFilesActive} label="Conversation" />
			<NavItem
				href={`${basePath}/changes`}
				isActive={isFilesActive}
				label="Files Changed"
			/>
		</nav>
	);
}

interface NavItemProps {
	href: string;
	label: string;
	isActive?: boolean;
}

function NavItem({ href, label, isActive }: NavItemProps) {
	return (
		<Link
			className={`block rounded-md px-3 py-2 font-medium text-sm transition-colors ${
				isActive
					? "bg-gray-100 text-gray-900"
					: "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
			}`}
			href={href}
		>
			{label}
		</Link>
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

function Checks({ checksPromise }: ChecksProps) {
	const checks = use(checksPromise);
	return (
		<>
			<h3 className="mb-2 font-semibold text-gray-900 text-sm">Checks</h3>
			{checks && checks.length > 0 ? (
				<div className="max-h-full space-y-2 overflow-y-auto">
					{checks.map((check) => (
						<a
							className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-gray-50"
							href={check.html_url}
							key={check.name}
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
							<span className="truncate text-gray-700 text-sm">
								{check.name}
							</span>
						</a>
					))}
				</div>
			) : (
				<p className="text-gray-500 text-sm">No checks</p>
			)}
		</>
	);
}
