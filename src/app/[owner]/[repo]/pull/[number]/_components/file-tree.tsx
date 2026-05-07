"use client";

import { useState } from "react";

import iconMapData from "~/utils/iconMap.json";

const iconMap: Record<string, string> = iconMapData as Record<string, string>;

export interface FileNode {
	name: string;
	path: string;
	children?: FileNode[];
	isFile?: boolean;
	status?: string;
	additions?: number;
	deletions?: number;
}

export function buildFileTree(
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

			if (isFile) {
				node.status = file.status;
				node.additions = file.additions;
				node.deletions = file.deletions;
			}

			if (!isFile && node.children) {
				currentLevel = node.children;
			}
		}
	}

	return root;
}

export function FileTree({
	files,
	basePath,
}: {
	files: FileNode[];
	basePath: string;
}) {
	return (
		<div className="max-h-full space-y-0.5 overflow-y-auto">
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
				className="flex items-center gap-1.5 truncate rounded px-2 py-1 text-gray-700 text-sm transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
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
				className="flex w-full cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-gray-700 text-sm transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
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

export function FileTreeSkeleton() {
	const skeletonItems = [
		{ depth: 0 },
		{ depth: 0 },
		{ depth: 1 },
		{ depth: 1 },
		{ depth: 1 },
		{ depth: 0 },
		{ depth: 2 },
		{ depth: 0 },
	];

	return (
		<div className="space-y-0.5">
			{skeletonItems.map((item, i) => {
				const paddingLeft = item.depth * 12 + 16;
				return (
					<div
						className="flex items-center gap-1.5 rounded px-2 py-2"
						key={i}
						style={{ paddingLeft: `${paddingLeft}px` }}
					>
						<div className="h-4 w-4 flex-shrink-0 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
						<div className="h-4 flex-1 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
					</div>
				);
			})}
		</div>
	);
}
