"use client";

import { Diff2HtmlUI } from "diff2html/lib/ui/js/diff2html-ui";
import { useEffect, useRef, useState } from "react";
import "diff2html/bundles/css/diff2html.min.css";

interface FileDiffProps {
	file: {
		filename: string;
		patch?: string | null;
		status: string;
		additions: number;
		deletions: number;
	};
	owner: string;
	repo: string;
	number: string;
}

function getViewedKey(owner: string, repo: string, number: string): string {
	return `pr-file:viewed:${owner}:${repo}:${number}`;
}

function getStoredSet(key: string): Set<string> {
	if (typeof window === "undefined") return new Set();
	try {
		const data = localStorage.getItem(key);
		if (!data) return new Set();
		return new Set(JSON.parse(data) as string[]);
	} catch {
		return new Set();
	}
}

function setStoredSet(key: string, set: Set<string>): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(key, JSON.stringify(Array.from(set)));
}

export default function FileDiff({ file, owner, repo, number }: FileDiffProps) {
	const [isViewed, setIsViewed] = useState<boolean>(false);

	const [isCollapsed, setIsCollapsed] = useState<boolean>(isViewed);
	const toggleCollapsed = () => setIsCollapsed(!isCollapsed);

	const containerRef = useRef<HTMLDivElement>(null);

	const fileId = file.filename.replace(/\//g, "-");

	// Hydrate from localStorage after mount, on the client only
	useEffect(() => {
		const viewed = getStoredSet(getViewedKey(owner, repo, number));
		const wasViewed = viewed.has(file.filename);
		setIsViewed(wasViewed);
		setIsCollapsed(wasViewed);
	}, [owner, repo, number, file.filename]);

	useEffect(() => {
		if (containerRef.current && file.patch) {
			const normalizedDiff = file.patch.startsWith("---")
				? file.patch
				: `--- a/${file.filename}\n+++ b/${file.filename}\n${file.patch}`;
			const diff2htmlUi = new Diff2HtmlUI(
				containerRef.current,
				normalizedDiff,
				{
					drawFileList: false,
					matching: "lines",
					outputFormat: "line-by-line",
					highlight: true,
				},
			);
			diff2htmlUi.draw();
		}
	}, [file.patch, file.filename, isCollapsed]);

	const toggleViewed = () => {
		const key = getViewedKey(owner, repo, number);
		const viewed = getStoredSet(key);
		if (isViewed) {
			viewed.delete(file.filename);
		} else {
			viewed.add(file.filename);
		}
		setStoredSet(key, viewed);
		setIsViewed(!isViewed);
		if (!isViewed && !isCollapsed) {
			toggleCollapsed();
		} else if (isViewed && isCollapsed) {
			toggleCollapsed();
		}
	};

	const statusColor =
		file.status === "added"
			? "text-green-600"
			: file.status === "deleted"
				? "text-red-600"
				: file.status === "renamed"
					? "text-blue-600"
					: "text-yellow-600";

	return (
		<div
			className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700"
			id={fileId}
		>
			{/* File Header */}
			<div className="flex items-center gap-2 border-gray-200 border-b bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-900">
				{/* Collapse Toggle */}
				<button
					className="cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
					onClick={toggleCollapsed}
					type="button"
				>
					<svg
						className={`h-4 w-4 transition-transform ${isCollapsed ? "-rotate-90" : "rotate-0"}`}
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<title>Toggle collapse</title>
						<path
							d="M19 9l-7 7-7-7"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
						/>
					</svg>
				</button>

				{/* File Icon */}
				<button
					className="h-4 w-4 cursor-pointer text-gray-500 dark:text-gray-400"
					onClick={toggleCollapsed}
					type="button"
				>
					<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<title>File</title>
						<path
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
						/>
					</svg>
				</button>

				{/* Filename */}
				<button
					className="flex-1 cursor-pointer truncate text-left font-mono text-gray-700 text-sm dark:text-gray-300"
					onClick={toggleCollapsed}
					type="button"
				>
					{file.filename}
				</button>

				{/* Status Badge */}
				<span className={`font-medium text-xs ${statusColor}`}>
					{file.status}
				</span>

				{/* Diff Stats */}
				{file.additions > 0 && (
					<span className="font-medium text-green-600 text-xs">
						+{file.additions}
					</span>
				)}
				{file.deletions > 0 && (
					<span className="font-medium text-red-600 text-xs">
						-{file.deletions}
					</span>
				)}

				{/* Viewed Checkbox */}
				<label className="flex cursor-pointer items-center gap-1 text-gray-600 text-xs hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
					<input
						checked={isViewed}
						className="cursor-pointer rounded border-gray-300 dark:border-gray-600"
						onChange={toggleViewed}
						type="checkbox"
					/>
					Viewed
				</label>
			</div>

			{/* Diff Content */}
			{!isCollapsed && (
				<div className="overflow-x-auto">
					<style>{`
						/* We render our own header so hide the built in one */
						.d2h-file-header { display: none; }


						/* Reset hljs background on diff lines */
						.d2h-del .hljs,
						.d2h-ins .hljs {
						  background: transparent !important;
						}
					`}</style>

					{file.patch ? (
						<div ref={containerRef} />
					) : (
						<div className="px-4 py-3 text-gray-500 text-sm italic dark:text-gray-400">
							Binary file not shown
						</div>
					)}
				</div>
			)}
		</div>
	);
}
