"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { FileTree, FileTreeSkeleton, buildFileTree } from "./file-tree";

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

interface LeftSidebarProps {
	owner: string;
	repo: string;
	number: string;
	checks?: Array<{
		name: string;
		conclusion: string | null;
		status: string;
		html_url?: string;
	}>;
}

export default function LeftSidebar({
	owner,
	repo,
	number,
	checks,
}: LeftSidebarProps) {
	const pathname = usePathname();
	const basePath = `/${owner}/${repo}/pull/${number}`;
	const isFilesActive =
		pathname === `${basePath}/changes` ||
		pathname.startsWith(`${basePath}/changes/`);
	const isConversationActive =
		pathname === basePath || pathname === `${basePath}/`;

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
	const [loading, setLoading] = useState(false);

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
		<aside className="flex h-full flex-col border-gray-200 border-r bg-white px-4 py-6">
			<nav className="sticky top-0 z-10 space-y-1 bg-white pb-4">
				<NavItem
					href={basePath}
					isActive={isConversationActive}
					label="Conversation"
				/>
				<NavItem
					href={`${basePath}/changes`}
					isActive={isFilesActive}
					label="Files Changed"
				/>
			</nav>

			{/* Checks or File Tree Section */}
			<div className="min-h-0 flex-1 overflow-y-auto border-gray-200 border-t pt-4">
				{isFilesActive ? (
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
				) : (
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
				)}
			</div>

			<div className="sticky bottom-0 z-10 space-y-2 border-gray-200 border-t bg-white pt-6">
				<button
					className="w-full rounded-md bg-[#2da44e] px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-[#218838] disabled:opacity-50"
					disabled
					type="button"
				>
					Approve
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
			</div>
		</aside>
	);
}
