"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { IssueAutocomplete } from "./issue-autocomplete";
import { MarkdownRenderer } from "./MarkdownRenderer";
import {
	applyCodeBlockFormat,
	applyInlineFormat,
	applyListFormat,
	findLineStart,
} from "./markdown-utils";

interface MarkdownEditorProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit?: () => void;
	onCancel?: () => void;
	placeholder?: string;
	submitLabel?: string;
	cancelLabel?: string;
	disabled?: boolean;
	minHeight?: string;
	className?: string;
	owner?: string;
	repo?: string;
}

export function MarkdownEditor({
	value,
	onChange,
	onSubmit,
	onCancel,
	placeholder = "",
	submitLabel = "Comment",
	cancelLabel = "Cancel",
	disabled = false,
	minHeight = "auto",
	className = "",
	owner,
	repo,
}: MarkdownEditorProps) {
	const [mode, setMode] = useState<"write" | "preview">("write");
	const [autocompleteQuery, setAutocompleteQuery] = useState<string | null>(
		null,
	);
	const [autocompleteIndex, setAutocompleteIndex] = useState(0);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const cursorRef = useRef<{ start: number; end: number } | null>(null);
	const valueRef = useRef(value);
	const onChangeRef = useRef(onChange);
	const disabledRef = useRef(disabled);
	const containerRef = useRef<HTMLDivElement>(null);
	const cursorPosRef = useRef(0);
	const savedSelectionRef = useRef({ start: 0, end: 0 });
	const [dropdownTop, setDropdownTop] = useState(80);

	valueRef.current = value;
	onChangeRef.current = onChange;
	disabledRef.current = disabled;

	const {
		data: autocompleteIssues = [],
		isFetching: issuesLoading,
		isError: issuesError,
		error: issuesErrorObj,
	} = api.issues.search.useQuery(
		{
			owner: owner ?? "",
			repo: repo ?? "",
			query: autocompleteQuery ?? "",
		},
		{
			enabled: autocompleteQuery !== null && !!owner && !!repo,
			staleTime: 30_000,
			placeholderData: keepPreviousData,
		},
	);

	function detectAutocomplete(text: string, cursorPos: number): string | null {
		const textBeforeCursor = text.slice(0, cursorPos);
		const match = textBeforeCursor.match(/(?:^|\s)(#[\w-]*)$/);
		if (!match || !match[1]) return null;
		const query = match[1].slice(1);
		return query;
	}

	const dismissAutocomplete = useCallback(() => {
		setAutocompleteQuery(null);
		setAutocompleteIndex(0);
	}, []);

	const handleAutocompleteSelect = useCallback(
		(issueNumber: number) => {
			const textarea = textareaRef.current;
			if (!textarea) return;
			const cursorPos = textarea.selectionStart;
			const textBeforeCursor = valueRef.current.slice(0, cursorPos);
			const match = textBeforeCursor.match(/(?:^|\s)(#[\w-]*)$/);
			if (!match) return;
			const hashStart = match.index! + (match[0].startsWith("#") ? 0 : 1);
			const replaceEnd = cursorPos;
			const replacement = `#${issueNumber}`;
			const newText =
				valueRef.current.slice(0, hashStart) +
				replacement +
				valueRef.current.slice(replaceEnd);
			cursorRef.current = {
				start: hashStart + replacement.length,
				end: hashStart + replacement.length,
			};
			onChangeRef.current(newText);
			dismissAutocomplete();
		},
		[dismissAutocomplete],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: need to re-run after value changes to restore cursor
	useEffect(() => {
		if (cursorRef.current && textareaRef.current) {
			const { start, end } = cursorRef.current;
			textareaRef.current.setSelectionRange(start, end);
			cursorRef.current = null;
		}
	}, [value]);

	const applyFormatting = useCallback(
		(
			formatter: (
				text: string,
				cursorStart: number,
				cursorEnd: number,
			) => { newText: string; newStart: number; newEnd: number },
		) => {
			const textarea = textareaRef.current;
			if (!textarea || disabledRef.current) return;

			const isFocused = document.activeElement === textarea;
			const start = isFocused
				? textarea.selectionStart
				: savedSelectionRef.current.start;
			const end = isFocused
				? textarea.selectionEnd
				: savedSelectionRef.current.end;
			const { newText, newStart, newEnd } = formatter(
				valueRef.current,
				start,
				end,
			);

			cursorRef.current = { start: newStart, end: newEnd };
			onChangeRef.current(newText);
		},
		[],
	);

	const handleBold = useCallback(() => {
		applyFormatting((text, start, end) =>
			applyInlineFormat(text, start, end, "**", "bold"),
		);
	}, [applyFormatting]);

	const handleItalic = useCallback(() => {
		applyFormatting((text, start, end) =>
			applyInlineFormat(text, start, end, "_", "italic"),
		);
	}, [applyFormatting]);

	const handleHeading = useCallback(() => {
		applyFormatting((text, start, end) => {
			const lineStart = findLineStart(text, start);
			const prefix = "## ";
			return {
				newText: text.slice(0, lineStart) + prefix + text.slice(lineStart),
				newStart: start + prefix.length,
				newEnd: end + prefix.length,
			};
		});
	}, [applyFormatting]);

	const handleStrikethrough = useCallback(() => {
		applyFormatting((text, start, end) =>
			applyInlineFormat(text, start, end, "~~", "strikethrough"),
		);
	}, [applyFormatting]);

	const handleCode = useCallback(() => {
		applyFormatting((text, start, end) =>
			applyInlineFormat(text, start, end, "`", "code"),
		);
	}, [applyFormatting]);

	const handleCodeBlock = useCallback(() => {
		applyFormatting((text, start, end) =>
			applyCodeBlockFormat(text, start, end),
		);
	}, [applyFormatting]);

	const handleLink = useCallback(() => {
		applyFormatting((text, start, end) => {
			const selected = text.slice(start, end);
			const linkText = selected || "text";
			return {
				newText: `${text.slice(0, start)}[${linkText}](url)${text.slice(end)}`,
				newStart: start + 1,
				newEnd: start + 1 + linkText.length,
			};
		});
	}, [applyFormatting]);

	const handleUnorderedList = useCallback(() => {
		applyFormatting((text, start, end) =>
			applyListFormat(text, start, end, "- "),
		);
	}, [applyFormatting]);

	const handleOrderedList = useCallback(() => {
		applyFormatting((text, start, end) =>
			applyListFormat(text, start, end, "1. "),
		);
	}, [applyFormatting]);

	const handleTaskList = useCallback(() => {
		applyFormatting((text, start, end) =>
			applyListFormat(text, start, end, "- [ ] "),
		);
	}, [applyFormatting]);

	const handleBlockquote = useCallback(() => {
		applyFormatting((text, start, end) => {
			const lineStart = findLineStart(text, start);
			const lineEnd = text.indexOf("\n", lineStart);
			const lineText =
				lineEnd === -1 ? text.slice(lineStart) : text.slice(lineStart, lineEnd);
			const prefix = "> ";
			if (lineText.startsWith(prefix)) {
				return {
					newText:
						text.slice(0, lineStart) + text.slice(lineStart + prefix.length),
					newStart: Math.max(start - prefix.length, lineStart),
					newEnd: Math.max(end - prefix.length, lineStart),
				};
			}
			return {
				newText: text.slice(0, lineStart) + prefix + text.slice(lineStart),
				newStart: start + prefix.length,
				newEnd: end + prefix.length,
			};
		});
	}, [applyFormatting]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (autocompleteQuery !== null) {
				if (e.key === "ArrowUp") {
					e.preventDefault();
					setAutocompleteIndex((i) => Math.max(0, i - 1));
					return;
				}
				if (e.key === "ArrowDown") {
					e.preventDefault();
					setAutocompleteIndex((i) => i + 1);
					return;
				}
				if (e.key === "Enter") {
					e.preventDefault();
					const issue = autocompleteIssues[autocompleteIndex];
					if (issue) {
						handleAutocompleteSelect(issue.number);
					}
					return;
				}
				if (e.key === "Escape") {
					e.preventDefault();
					dismissAutocomplete();
					return;
				}
			}

			if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "b") {
				e.preventDefault();
				handleBold();
			} else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "i") {
				e.preventDefault();
				handleItalic();
			} else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "k") {
				e.preventDefault();
				handleLink();
			} else if (
				(e.metaKey || e.ctrlKey) &&
				e.shiftKey &&
				(e.key === "k" || e.key === "K")
			) {
				e.preventDefault();
				handleCodeBlock();
			} else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				onSubmit?.();
			} else if (e.key === "Escape") {
				onCancel?.();
			}
		},
		[
			autocompleteQuery,
			autocompleteIssues,
			autocompleteIndex,
			handleAutocompleteSelect,
			dismissAutocomplete,
			handleBold,
			handleItalic,
			handleLink,
			handleCodeBlock,
			onSubmit,
			onCancel,
		],
	);

	const isMac =
		typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
	const tooltipMod = isMac ? "⌘" : "Ctrl";

	const toolbarGroups = [
		[
			{
				label: "B",
				title: `Bold (${tooltipMod}+B)`,
				onClick: handleBold,
			},
			{
				label: "I",
				title: `Italic (${tooltipMod}+I)`,
				onClick: handleItalic,
			},
			{ label: "H", title: "Heading", onClick: handleHeading },
			{
				label: "S",
				title: "Strikethrough",
				onClick: handleStrikethrough,
			},
		],
		[
			{ label: "<>", title: "Inline code", onClick: handleCode },
			{
				label: "{}",
				title: `Code block (${tooltipMod}+Shift+K)`,
				onClick: handleCodeBlock,
			},
			{
				label: "Link",
				title: `Link (${tooltipMod}+K)`,
				onClick: handleLink,
			},
		],
		[
			{
				label: "-",
				title: "Unordered list",
				onClick: handleUnorderedList,
			},
			{
				label: "1.",
				title: "Ordered list",
				onClick: handleOrderedList,
			},
			{ label: "[]", title: "Task list", onClick: handleTaskList },
			{ label: ">", title: "Blockquote", onClick: handleBlockquote },
		],
	];

	return (
		<div
			className={`relative rounded-lg border border-gray-300 dark:border-gray-600 ${className}`}
			ref={containerRef}
		>
			<div className="-mb-px flex items-center gap-6 rounded-t-lg border-gray-300 border-b bg-gray-50 px-3 dark:border-gray-600 dark:bg-zinc-900">
				<button
					className={`cursor-pointer border-b-2 px-1 py-2 font-medium text-sm ${mode === "write"
						? "border-blue-500 text-blue-600"
						: "border-transparent text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
						}`}
					onClick={() => setMode("write")}
					type="button"
				>
					Write
				</button>
				<button
					className={`cursor-pointer border-b-2 px-1 py-2 font-medium text-sm ${mode === "preview"
						? "border-blue-500 text-blue-600"
						: "border-transparent text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
						}`}
					onClick={() => setMode("preview")}
					type="button"
				>
					Preview
				</button>
			</div>

			{mode === "write" ? (
				<>
					<div className="flex flex-wrap items-center gap-0.5 border-gray-300 border-b px-3 py-1.5 dark:border-gray-600">
						{toolbarGroups.map((group, gi) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: toolbar groups are static
							<span className="flex items-center gap-0.5" key={gi}>
								{gi > 0 && (
									<span className="mx-1 select-none text-gray-300 dark:text-gray-600">
										|
									</span>
								)}
								{group.map((btn) => (
									<button
										className="inline-flex items-center justify-center rounded-md px-1.5 py-1 font-medium text-gray-600 text-sm hover:bg-gray-200 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
										disabled={disabled}
										key={btn.label}
										onMouseDown={(e) => {
											const textarea = textareaRef.current;
											if (textarea) {
												savedSelectionRef.current = {
													start: textarea.selectionStart,
													end: textarea.selectionEnd,
												};
											}
											e.preventDefault();
										}}
										onClick={btn.onClick}
										title={btn.title}
										type="button"
									>
										{btn.label}
									</button>
								))}
							</span>
						))}
					</div>

					{autocompleteQuery !== null &&
						owner &&
						repo &&
						!issuesLoading &&
						autocompleteIssues.length > 0 && (
							<IssueAutocomplete
								issues={autocompleteIssues}
								loading={issuesLoading}
								error={
									issuesError
										? (issuesErrorObj?.message ?? "Unknown error")
										: null
								}
								selectedIndex={autocompleteIndex}
								onSelect={handleAutocompleteSelect}
								style={{ top: dropdownTop }}
							/>
						)}
					<textarea
						className="w-full resize-y rounded-b-lg border-0 px-3 py-2 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-0 disabled:bg-gray-50 dark:bg-zinc-950 dark:text-gray-100 dark:placeholder-gray-500"
						disabled={disabled}
						onBlur={(e) => {
							savedSelectionRef.current = {
								start: e.target.selectionStart,
								end: e.target.selectionEnd,
							};
							setTimeout(() => {
								if (
									document.activeElement?.closest('[data-autocomplete="true"]')
								)
									return;
								dismissAutocomplete();
							}, 100);
						}}
						onChange={(e) => {
							const newValue = e.target.value;
							const cursorPos = e.target.selectionStart;
							onChangeRef.current(newValue);
							if (!disabledRef.current && owner && repo) {
								const q = detectAutocomplete(newValue, cursorPos);
								setAutocompleteQuery(q);
								setAutocompleteIndex(0);
								if (q !== null) {
									const textarea = e.target;
									const lineNumber =
										newValue.slice(0, cursorPos).split("\n").length - 1;
									const top =
										textarea.offsetTop +
										8 +
										(lineNumber + 1) * 20 -
										textarea.scrollTop;
									setDropdownTop(top);
								}
							}
						}}
						onKeyDown={handleKeyDown}
						onKeyUp={(e) => {
							if (
								autocompleteQuery !== null &&
								["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
							) {
								const textarea = textareaRef.current;
								if (textarea) {
									const q = detectAutocomplete(
										textarea.value,
										textarea.selectionStart,
									);
									if (q === null) {
										dismissAutocomplete();
									}
								}
							}
						}}
						placeholder={placeholder}
						ref={textareaRef}
						style={{ minHeight }}
						value={value}
					/>
				</>
			) : (
				<div
					className="prose prose-sm dark:prose-invert max-w-none px-3 py-2"
					style={{ minHeight }}
				>
					<MarkdownRenderer content={value} owner={owner} repo={repo} />
				</div>
			)}

			{(onSubmit || onCancel) && (
				<div className="flex items-center justify-end gap-2 border-gray-300 border-t px-3 py-2 dark:border-gray-600">
					{onCancel && (
						<button
							className="cursor-pointer rounded-md border border-gray-300 px-4 py-1.5 font-medium text-gray-600 text-sm transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
							disabled={disabled}
							onClick={onCancel}
							type="button"
						>
							{cancelLabel}
						</button>
					)}
					{onSubmit && (
						<button
							className="cursor-pointer rounded-md bg-[#2da44e] px-4 py-1.5 font-medium text-sm text-white transition-colors hover:bg-[#218838] disabled:cursor-not-allowed disabled:opacity-50"
							disabled={disabled || !value.trim()}
							onClick={onSubmit}
							type="button"
						>
							{submitLabel}
						</button>
					)}
				</div>
			)}
		</div>
	);
}
