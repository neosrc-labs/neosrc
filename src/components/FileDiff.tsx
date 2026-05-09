"use client";

import { parse } from "diff2html";
import "diff2html/bundles/css/diff2html.min.css";
import hljs from "highlight.js";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReviewCommentData } from "~/server/github";
import { api } from "~/trpc/react";
import { InlineCommentThread } from "./InlineCommentThread";
import { MarkdownEditor } from "./markdown/MarkdownEditor";

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
	comments?: ReviewCommentData[];
}

interface ActiveComment {
	line: number;
	side: "LEFT" | "RIGHT";
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

export default function FileDiff({
	file,
	owner,
	repo,
	number,
	comments = [],
}: FileDiffProps) {
	const [isViewed, setIsViewed] = useState(false);
	const [isCollapsed, setIsCollapsed] = useState(isViewed);
	const [activeComment, setActiveComment] = useState<ActiveComment | null>(
		null,
	);
	const [commentBody, setCommentBody] = useState("");
	const utils = api.useUtils();

	const fileId = file.filename.replace(/\//g, "-");

	useEffect(() => {
		const viewed = getStoredSet(getViewedKey(owner, repo, number));
		const wasViewed = viewed.has(file.filename);
		setIsViewed(wasViewed);
		setIsCollapsed(wasViewed);
	}, [owner, repo, number, file.filename]);

	const parsed = useMemo(() => {
		if (!file.patch) return null;
		const normalizedDiff = file.patch.startsWith("---")
			? file.patch
			: `--- a/${file.filename}\n+++ b/${file.filename}\n${file.patch}`;
		const files = parse(normalizedDiff);
		return files[0] ?? null;
	}, [file.patch, file.filename]);

	const diffRef = useRef<HTMLDivElement>(null);

	const language = useMemo(() => {
		const ext = file.filename.split(".").pop()?.toLowerCase();
		if (!ext) return null;
		const langMap: Record<string, string> = {
			tsx: "typescript",
			jsx: "javascript",
			mjs: "javascript",
			cjs: "javascript",
			mts: "typescript",
			cts: "typescript",
			vue: "html",
			svelte: "html",
		};
		const lang = langMap[ext] ?? ext;
		try {
			return hljs.getLanguage(lang) ? lang : null;
		} catch {
			return null;
		}
	}, [file.filename]);

	useEffect(() => {
		if (!diffRef.current || !language || !parsed) return;
		const lines =
			diffRef.current.querySelectorAll<HTMLElement>(".d2h-code-line-ctn");
		lines.forEach((el) => {
			const text = el.textContent;
			if (!text) return;
			const result = hljs.highlight(text, { language });
			el.innerHTML = result.value;
		});
	}, [language, parsed]);

	const commentsByLine = useMemo(() => {
		const map = new Map<number, ReviewCommentData[]>();
		for (const comment of comments) {
			const key = comment.line ?? 0;
			const existing = map.get(key) ?? [];
			existing.push(comment);
			map.set(key, existing);
		}
		return map;
	}, [comments]);

	const createMutation = api.reviewComments.create.useMutation({
		onSuccess: () => {
			setCommentBody("");
			setActiveComment(null);
			utils.reviewComments.list.invalidate();
		},
	});

	const handleAddComment = useCallback(() => {
		if (!commentBody.trim() || !activeComment) return;
		createMutation.mutate({
			owner,
			repo,
			number: Number(number),
			filePath: file.filename,
			lineNumber: activeComment.line,
			side: activeComment.side,
			body: commentBody,
		});
	}, [
		commentBody,
		activeComment,
		createMutation,
		owner,
		repo,
		number,
		file.filename,
	]);

	const toggleCollapsed = () => setIsCollapsed(!isCollapsed);

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
			className="mb-6 scroll-mt-[calc(var(--header-height)+8px)] rounded-lg border border-gray-200 dark:border-gray-700"
			id={fileId}
		>
			<div className="flex items-center gap-2 border-gray-200 border-b bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-900">
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

				<button
					className="flex-1 cursor-pointer truncate text-left font-mono text-gray-700 text-sm dark:text-gray-300"
					onClick={toggleCollapsed}
					type="button"
				>
					{file.filename}
				</button>

				<span className={`font-medium text-xs ${statusColor}`}>
					{file.status}
				</span>

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

			{!isCollapsed && (
				<div className="overflow-x-auto">
					<style>{`
						.d2h-file-header { display: none !important; }
						.d2h-del .hljs, .d2h-ins .hljs {
						  background: transparent !important;
						}
						.neosrc-diff .d2h-code-line {
						  padding: 0 !important;
						  width: auto !important;
						  display: block !important;
						  white-space: pre !important;
						}
						.neosrc-diff .d2h-code-linenumber {
						  position: relative !important;
						  display: table-cell !important;
						  width: 7.5em !important;
						  min-width: 7.5em !important;
						  padding: 0 !important;
						  vertical-align: top !important;
						  text-align: right !important;
						  direction: rtl !important;
						  border-right: 1px solid var(--d2h-line-border-color, #eee) !important;
						}
						.neosrc-diff .d2h-diff-table td:last-child {
						  width: 100% !important;
						}
						.neosrc-diff .d2h-code-line-ctn {
						  width: 100% !important;
						}
						.neosrc-diff .comment-btn {
						  opacity: 0;
						  transition: opacity 0.1s;
						  cursor: pointer;
						  background: none;
						  border: none;
						  color: #6366f1;
						  font-size: 13px;
						  line-height: 1;
						  padding: 0 4px;
						  vertical-align: middle;
						  margin-left: 4px;
						}
						.neosrc-diff tr:hover .comment-btn,
						.neosrc-diff tr:hover .comment-btn-active {
						  opacity: 1;
						}
						.neosrc-diff td {
						  white-space: nowrap;
						}
					`}</style>
					<div className="neosrc-diff" ref={diffRef}>
						{parsed ? (
							<table className="d2h-diff-table">
								<tbody className="d2h-diff-tbody">
									{parsed.blocks.map((block) => (
										<BlockRows
											key={`${block.oldStartLine}-${block.newStartLine}-${block.header}`}
											block={block}
											commentsByLine={commentsByLine}
											activeComment={activeComment}
											onStartComment={setActiveComment}
											owner={owner}
											repo={repo}
											pullNumber={number}
											commentBody={commentBody}
											onCommentBodyChange={setCommentBody}
											onSubmitComment={handleAddComment}
											commentPending={createMutation.isPending}
											commentError={createMutation.isError}
											onCancelComment={() => {
												setActiveComment(null);
												setCommentBody("");
											}}
										/>
									))}
								</tbody>
							</table>
						) : (
							<div className="px-4 py-3 text-gray-500 text-sm italic dark:text-gray-400">
								{file.patch === null ? "Binary file not shown" : "No changes"}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

function groupThreads(
	comments: ReviewCommentData[],
): Array<{ parent: ReviewCommentData; replies: ReviewCommentData[] }> {
	const threads = new Map<number, ReviewCommentData[]>();
	for (const comment of comments) {
		const rootId = comment.in_reply_to_id ?? comment.id;
		const existing = threads.get(rootId) ?? [];
		existing.push(comment);
		threads.set(rootId, existing);
	}
	return Array.from(threads.entries()).map(([, group]) => ({
		parent: group[0] as ReviewCommentData,
		replies: group.slice(1),
	}));
}

interface BlockRowsProps {
	block: NonNullable<ReturnType<typeof parse>>[number]["blocks"][number];
	commentsByLine: Map<number, ReviewCommentData[]>;
	activeComment: ActiveComment | null;
	onStartComment: (ac: ActiveComment | null) => void;
	owner: string;
	repo: string;
	pullNumber: string;
	commentBody: string;
	onCommentBodyChange: (body: string) => void;
	onSubmitComment: () => void;
	commentPending: boolean;
	commentError: boolean;
	onCancelComment: () => void;
}

function BlockRows({
	block,
	commentsByLine,
	activeComment,
	onStartComment,
	owner,
	repo,
	pullNumber,
	commentBody,
	onCommentBodyChange,
	onSubmitComment,
	commentPending,
	commentError,
	onCancelComment,
}: BlockRowsProps) {
	return (
		<>
			<tr>
				<td className="d2h-code-linenumber d2h-info" />
				<td className="d2h-info">
					<div className="d2h-code-line">{block.header}</div>
				</td>
			</tr>
			{block.lines.map((line) => {
				const type = line.type;
				const typeClass =
					type === "insert"
						? "d2h-ins d2h-change"
						: type === "delete"
							? "d2h-del d2h-change"
							: "d2h-cntx";

				const oldNum =
					"oldNumber" in line
						? (line as { oldNumber: number }).oldNumber
						: undefined;
				const newNum =
					"newNumber" in line
						? (line as { newNumber: number }).newNumber
						: undefined;

				const commentLine = newNum ?? oldNum ?? 0;
				const side = type === "delete" ? "LEFT" : "RIGHT";

				const lineComments = commentsByLine.get(commentLine) ?? [];
				const isActive =
					activeComment?.line === commentLine && activeComment?.side === side;
				const hasComments = lineComments.length > 0;

				const prefix = line.content[0] ?? " ";
				const content = line.content.slice(1);

				return (
					<Fragment key={`${oldNum ?? ""}-${newNum ?? ""}-${line.content}`}>
						<tr className="d2h-code-line">
							<td className={`d2h-code-linenumber ${typeClass}`}>
								<div className="line-num1">
									{oldNum !== undefined ? oldNum : ""}
								</div>
								<div className="line-num2">
									{newNum !== undefined ? newNum : ""}
								</div>
								<button
									className={`comment-btn ${isActive ? "comment-btn-active" : ""}`}
									onClick={() =>
										onStartComment(
											isActive ? null : { line: commentLine, side },
										)
									}
									type="button"
									title="Add a comment"
								>
									+
								</button>
							</td>
							<td className={typeClass}>
								<div className="d2h-code-line">
									<span className="d2h-code-line-prefix">
										{prefix === " " ? "\u00A0" : prefix}
									</span>
									<span className="d2h-code-line-ctn">{content || <br />}</span>
								</div>
							</td>
						</tr>
						{hasComments &&
							groupThreads(lineComments).map((thread) => (
								<tr key={`thread-${thread.parent.id}`}>
									<td colSpan={2} className="p-0">
										<InlineCommentThread
											parentComment={thread.parent}
											replies={thread.replies}
											owner={owner}
											repo={repo}
											number={Number(pullNumber)}
										/>
									</td>
								</tr>
							))}
						{isActive && (
							<tr>
								<td
									colSpan={2}
									className="border-gray-200 border-t p-2 dark:border-gray-700"
								>
									<MarkdownEditor
										disabled={commentPending}
										onChange={onCommentBodyChange}
										onCancel={onCancelComment}
										onSubmit={onSubmitComment}
										placeholder="Add a comment..."
										submitLabel="Comment"
										value={commentBody}
										owner={owner}
										repo={repo}
									/>
									{commentError && (
										<p className="mt-1 text-red-600 text-xs">
											Failed to post comment. Please try again.
										</p>
									)}
								</td>
							</tr>
						)}
					</Fragment>
				);
			})}
		</>
	);
}
