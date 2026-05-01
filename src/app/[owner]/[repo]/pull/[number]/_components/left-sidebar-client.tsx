"use client";

import { usePathname } from "next/navigation";
import { buildFileTree, FileTree, FileTreeSkeleton } from "./file-tree";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface LeftSidebarContentSectionProps {
	owner: string;
	repo: string;
	number: string;
	checksPromise: Promise<Array<{
		name: string;
		conclusion: string | null;
		status: string;
		html_url?: string;
	}>>;
}

export function LeftSidebarContentSection({ owner, repo, number, checksPromise }: LeftSidebarContentSectionProps) {
	const pathname = usePathname();
	const basePath = `/${owner}/${repo}/pull/${number}`;
	const isFilesActive =
		pathname === `${basePath}/changes` ||
		pathname.startsWith(`${basePath}/changes/`);

	return isFilesActive ? (
		<SidebarFileTree
			owner={owner}
			repo={repo}
			number={number}
		/>
	) : (
		<Checks checksPromise={checksPromise} />
	)
}


interface SidebarFileTreeProps {
	owner: string;
	repo: string;
	number: string;
}

export function SidebarFileTree({ owner, repo, number }: SidebarFileTreeProps) {
	const pathname = usePathname();
	const basePath = `/${owner}/${repo}/pull/${number}`;
	const isFilesActive =
		pathname === `${basePath}/changes` ||
		pathname.startsWith(`${basePath}/changes/`);

	// Extract commit SHA from pathname if present
	const commitSha = useMemo(() => {
		const match = pathname?.match(/\/changes\/([a-f0-9]{7,40})/);
		return match ? match[1] : null;
	}, [pathname]);

	const [files, setFiles] = useState<
		Array<{
			filename: string;
			status: string;
			additions: number;
			deletions: number;
		}>
	>([]);
	const [loading, setLoading] = useState(true);

	const fetchFiles = useCallback(async () => {
		setLoading(true);
		try {
			const params = new URLSearchParams({
				owner,
				repo,
				number,
			});
			if (commitSha) {
				params.set("sha", commitSha);
			}
			const res = await fetch(`/api/files?${params.toString()}`);
			if (res.ok) {
				const data = await res.json();
				setFiles(data.files || []);
			}
		} catch {
			// Ignore fetch errors
		} finally {
			setLoading(false);
		}
	}, [owner, repo, number, commitSha]);

	useEffect(() => {
		if (isFilesActive) {
			fetchFiles();
		}
	}, [isFilesActive, fetchFiles]);

	const fileTree = useMemo(() => buildFileTree(files), [files]);

	return (
		<>
			<h3 className="mb-2 font-semibold text-gray-900 text-sm">
				Files Changed ({files.length})
			</h3>
			{loading ? (
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
	number: string;
}

export function SidebarNavMenu({ owner, repo, number }: SidebarNavMenuProps) {
	const pathname = usePathname();
	const basePath = `/${owner}/${repo}/pull/${number}`;
	const isFilesActive =
		pathname === `${basePath}/changes` ||
		pathname.startsWith(`${basePath}/changes/`);
	return (
		<nav className="sticky top-0 z-10 space-y-1 bg-white pb-4">
			<NavItem
				href={basePath}
				isActive={!isFilesActive}
				label="Conversation"
			/>
			<NavItem
				href={`${basePath}/changes`}
				isActive={isFilesActive}
				label="Files Changed"
			/>
		</nav>
	)
}

interface NavItemProps {
	href: string;
	label: string;
	isActive?: boolean;
}

function NavItem({ href, label, isActive }: NavItemProps) {
	return (
		<Link
			className={`block rounded-md px-3 py-2 font-medium text-sm transition-colors ${isActive
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
	checksPromise: Promise<Array<{
		name: string;
		conclusion: string | null;
		status: string;
		html_url?: string;
	}>>;
}

function Checks({ checksPromise }: ChecksProps) {
	const checks = use(checksPromise);
	return (
		<>
			<h3 className="mb-2 font-semibold text-gray-900 text-sm">Checks</h3>
			{checks && checks.length > 0 ? (
				<div className="space-y-2">
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
	)
}
