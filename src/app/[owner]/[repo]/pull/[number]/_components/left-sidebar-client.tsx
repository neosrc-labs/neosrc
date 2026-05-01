"use client";

import { usePathname } from "next/navigation";
import { buildFileTree, FileTree, FileTreeSkeleton } from "./file-tree";
import { useCallback, useEffect, useMemo, useState } from "react";


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
