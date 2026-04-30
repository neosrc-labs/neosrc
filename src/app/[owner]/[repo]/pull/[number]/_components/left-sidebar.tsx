"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

// Import the icon map with proper typing
import iconMapData from "~/utils/iconMap.json";

const iconMap: Record<string, string> = iconMapData as Record<string, string>;

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

interface FileNode {
	name: string;
	path: string;
	children?: FileNode[];
	isFile?: boolean;
	status?: string;
	additions?: number;
	deletions?: number;
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

function buildFileTree(
	files: Array<{
		filename: string;
		status: string;
		additions: number;
		deletions: number;
	}>,
): FileNode[] {
	const root: FileNode[] = [];

	for (const file of files) {
		const parts = file.filename.split("/");
		let currentLevel = root;
		let currentPath = "";

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			if (!part) continue;
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			const isFile = i === parts.length - 1;

			let node = currentLevel.find((n) => n.name === part);
			if (!node) {
				node = {
					name: part,
					path: currentPath,
					children: isFile ? undefined : [],
					isFile,
				};
				currentLevel.push(node);
			}

			// After this point, node is definitely defined
			const currentNode = node;

			if (isFile) {
				currentNode.status = file.status;
				currentNode.additions = file.additions;
				currentNode.deletions = file.deletions;
			}

			if (!isFile && currentNode.children) {
				currentLevel = currentNode.children;
			}
		}
	}

	return root;
}

function FileTree({
	files,
	basePath,
}: {
	files: FileNode[];
	basePath: string;
}) {
	return (
		<div className="space-y-0.5">
			{files.map((node) => (
				<FileTreeNode
					basePath={basePath}
					depth={0}
					key={node.path}
					node={node}
				/>
			))}
		</div>
	);
}

function FileTreeNode({
	node,
	depth,
	basePath,
}: {
	node: FileNode;
	depth: number;
	basePath: string;
}) {
	const [isOpen, setIsOpen] = useState(true);
	const paddingLeft = depth * 12 + 8 + (node.isFile ? 8 : 0);

	const fileId = node.path.replace(/\//g, "-");

	const getFileIcon = (filename: string) => {
		const parts = filename.split(".");
		if (parts.length > 1) {
			const ext = parts.pop()?.toLowerCase();
			return ext ? (iconMap[ext] ?? "file") : "file";
		}
		return "file";
	};

	if (node.isFile) {
		const iconName = getFileIcon(node.name);
		return (
			<a
				className="flex items-center gap-1.5 truncate rounded px-2 py-1 text-gray-700 text-sm transition-colors hover:bg-gray-50"
				href={`${basePath}/changes#${fileId}`}
				style={{ paddingLeft: `${paddingLeft}px` }}
			>
				<img
					alt=""
					className="h-4 w-4 flex-shrink-0"
					loading="lazy"
					src={`/material-icons/${iconName}.svg`}
				/>
				<span className="flex-1 truncate">{node.name}</span>
				{node.additions ? (
					<span className="font-medium text-green-600 text-xs">
						+{node.additions}
					</span>
				) : null}
				{node.deletions ? (
					<span className="font-medium text-red-600 text-xs">
						-{node.deletions}
					</span>
				) : null}
			</a>
		);
	}

	return (
		<div>
			<button
				className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-gray-700 text-sm transition-colors hover:bg-gray-50 cursor-pointer"
				onClick={() => setIsOpen(!isOpen)}
				style={{ paddingLeft: `${paddingLeft}px` }}
				type="button"
			>
				<svg
					className={`h-3 w-3 flex-shrink-0 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<title>Toggle folder</title>
					<path
						d="M19 9l-7 7-7-7"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
					/>
				</svg>
				<img
					alt=""
					className="h-4 w-4 flex-shrink-0"
					loading="lazy"
					src={`/material-icons/folder${isOpen ? "-open" : ""}.svg`}
				/>
				<span className="truncate">{node.name}</span>
			</button>
			{isOpen && node.children ? (
				<div>
					{node.children.map((child) => (
						<FileTreeNode
							basePath={basePath}
							depth={depth + 1}
							key={child.path}
							node={child}
						/>
					))}
				</div>
			) : null}
		</div>
	);
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
							<p className="text-gray-500 text-sm">Loading...</p>
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
