"use client";

import { defaultDiff2HtmlConfig, parse } from "diff2html";
import type { ColorSchemeType } from "diff2html/lib/types";
import "diff2html/bundles/css/diff2html.min.css";
import hljs from "highlight.js";
import { useTheme } from "next-themes";
import { Fragment, useEffect, useMemo, useRef } from "react";
import type { ReviewCommentData } from "~/server/github";
import type { FooterAction } from "./markdown/MarkdownEditor";
import { InlineCommentThread } from "./InlineCommentThread";
import { MarkdownEditor } from "./markdown/MarkdownEditor";
import { Plus } from "lucide-react";

export interface ActiveComment {
	line: number;
	side: "LEFT" | "RIGHT";
}

interface DiffViewProps {
	patch: string;
	filename: string;
	comments?: ReviewCommentData[];
	showComments?: boolean;
	showCommentButton?: boolean;
	activeComment?: ActiveComment | null;
	onStartComment?: (ac: ActiveComment | null) => void;
	commentBody?: string;
	onCommentBodyChange?: (body: string) => void;
	footerActions?: FooterAction[];
	commentPending?: boolean;
	commentError?: boolean;
	onCancelComment?: () => void;
	owner?: string;
	repo?: string;
	pullNumber?: number | string;
	pendingReviewId?: number | null;
}

export function DiffView({
	patch,
	filename,
	comments = [],
	showComments = false,
	showCommentButton = false,
	activeComment = null,
	onStartComment,
	commentBody = "",
	onCommentBodyChange,
	footerActions,
	commentPending = false,
	commentError = false,
	onCancelComment,
	owner,
	repo,
	pullNumber,
	pendingReviewId,
}: DiffViewProps) {
	const { resolvedTheme } = useTheme();

	const parsed = useMemo(() => {
		if (!patch) return null;
		const normalizedDiff = patch.startsWith("---")
			? patch
			: `--- a/${filename}\n+++ b/${filename}\n${patch}`;
		const files = parse(normalizedDiff, {
			...defaultDiff2HtmlConfig,
			colorScheme: (resolvedTheme === "light" || resolvedTheme === "dark"
				? resolvedTheme
				: defaultDiff2HtmlConfig.colorScheme) as ColorSchemeType,
		});
		return files[0] ?? null;
	}, [patch, filename, resolvedTheme]);

	const diffRef = useRef<HTMLDivElement>(null);

	const language = useMemo(() => {
		const ext = filename.split(".").pop()?.toLowerCase();
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
	}, [filename]);

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
			const key = comment.line ?? comment.position ?? 0;
			const existing = map.get(key) ?? [];
			existing.push(comment);
			map.set(key, existing);
		}
		return map;
	}, [comments]);

	if (!parsed) {
		return null;
	}

	return (
		<div className="overflow-x-auto">
			<div
				className={`d2h-wrapper ${resolvedTheme === "light" ? "d2h-light-color-scheme" : "d2h-dark-color-scheme"}`}
				ref={diffRef}
			>
				<table className="d2h-diff-table">
					<tbody className="d2h-diff-tbody">
						{parsed.blocks.map((block) => (
							<BlockRows
								key={`${block.oldStartLine}-${block.newStartLine}-${block.header}`}
								block={block}
								commentsByLine={commentsByLine}
								activeComment={activeComment}
								onStartComment={onStartComment}
								owner={owner}
								repo={repo}
								pullNumber={pullNumber}
								commentBody={commentBody}
								onCommentBodyChange={onCommentBodyChange}
								footerActions={footerActions}
								commentPending={commentPending}
								commentError={commentError}
								onCancelComment={onCancelComment}
								showComments={showComments}
								showCommentButton={showCommentButton}
								pendingReviewId={pendingReviewId}
							/>
						))}
					</tbody>
				</table>
			</div>
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
	onStartComment: ((ac: ActiveComment | null) => void) | undefined;
	owner: string | undefined;
	repo: string | undefined;
	pullNumber: number | string | undefined;
	commentBody: string;
	onCommentBodyChange: ((body: string) => void) | undefined;
	footerActions?: FooterAction[];
	commentPending: boolean;
	commentError: boolean;
	onCancelComment: (() => void) | undefined;
	showComments: boolean;
	showCommentButton: boolean;
	pendingReviewId?: number | null;
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
	footerActions,
	commentPending,
	commentError,
	onCancelComment,
	showComments,
	showCommentButton,
	pendingReviewId,
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

				const content = line.content.slice(1);

				return (
					<Fragment key={`${oldNum ?? ""}-${newNum ?? ""}-${line.content}`}>
						<tr>
							<td className={`d2h-code-linenumber ${typeClass}`}>
								<div className="absolute group">
									{showCommentButton && onStartComment && (
										<Plus
											size={24}
											className="hidden group-hover:block absolute z-10 bg-blue-500 text-white rounded-full p-1.5 -right-5"
											onClick={() =>
												onStartComment(
													isActive ? null : { line: commentLine, side },
												)
											}
										/>
									)}
									<div className="line-num1">
										{oldNum !== undefined ? oldNum : ""}
									</div>
									<div className="line-num2">
										{newNum !== undefined ? newNum : ""}
									</div>
								</div>
							</td>
							<td className={typeClass}>
								<div className="d2h-code-line" style={{ display: 'flex' }}>
									<span className="d2h-code-line-ctn">{content || <br />}</span>
								</div>
							</td>
						</tr>
						{
							showComments &&
							hasComments &&
							groupThreads(lineComments).map((thread) => (
								<tr key={`thread-${thread.parent.id}`}>
									<td colSpan={2} className="p-0 dark:bg-zinc-950">
										<InlineCommentThread
											parentComment={thread.parent}
											replies={thread.replies}
											owner={owner ?? ""}
											repo={repo ?? ""}
											number={Number(pullNumber ?? 0)}
											pendingReviewId={pendingReviewId}
										/>
									</td>
								</tr>
							))
						}
						{
							isActive && (
								<tr>
									<td
										colSpan={2}
										className="border-gray-200 border-t p-2 dark:border-gray-700"
									>
										<MarkdownEditor
											disabled={commentPending}
											onChange={onCommentBodyChange ?? (() => { })}
											onCancel={onCancelComment ?? (() => { })}
											placeholder="Add a comment..."
											value={commentBody}
											owner={owner ?? ""}
											repo={repo ?? ""}
											footerActions={footerActions}
										/>
										{commentError && (
											<p className="mt-1 text-red-600 text-xs">
												Failed to post comment. Please try again.
											</p>
										)}
									</td>
								</tr>
							)
						}
					</Fragment>
				);
			})}
		</>
	);
}
