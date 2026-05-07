"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";

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
}

function findLineStart(text: string, position: number): number {
	return text.lastIndexOf("\n", position - 1) + 1;
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
	minHeight = "200px",
	className = "",
}: MarkdownEditorProps) {
	const [mode, setMode] = useState<"write" | "preview">("write");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const cursorRef = useRef<{ start: number; end: number } | null>(null);
	const valueRef = useRef(value);
	const onChangeRef = useRef(onChange);
	const disabledRef = useRef(disabled);

	valueRef.current = value;
	onChangeRef.current = onChange;
	disabledRef.current = disabled;

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

			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
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
		applyFormatting((text, start, end) => {
			const selected = text.slice(start, end);
			if (selected) {
				return {
					newText: `${text.slice(0, start)}**${selected}**${text.slice(end)}`,
					newStart: start,
					newEnd: end + 4,
				};
			}
			return {
				newText: `${text.slice(0, start)}**bold**${text.slice(end)}`,
				newStart: start + 2,
				newEnd: start + 6,
			};
		});
	}, [applyFormatting]);

	const handleItalic = useCallback(() => {
		applyFormatting((text, start, end) => {
			const selected = text.slice(start, end);
			if (selected) {
				return {
					newText: `${text.slice(0, start)}_${selected}_${text.slice(end)}`,
					newStart: start,
					newEnd: end + 2,
				};
			}
			return {
				newText: `${text.slice(0, start)}_italic_${text.slice(end)}`,
				newStart: start + 1,
				newEnd: start + 7,
			};
		});
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
		applyFormatting((text, start, end) => {
			const selected = text.slice(start, end);
			if (selected) {
				return {
					newText: `${text.slice(0, start)}~~${selected}~~${text.slice(end)}`,
					newStart: start,
					newEnd: end + 4,
				};
			}
			return {
				newText: `${text.slice(0, start)}~~strikethrough~~${text.slice(end)}`,
				newStart: start + 2,
				newEnd: start + 15,
			};
		});
	}, [applyFormatting]);

	const handleCode = useCallback(() => {
		applyFormatting((text, start, end) => {
			const selected = text.slice(start, end);
			if (selected) {
				return {
					newText: `${text.slice(0, start)}\`${selected}\`${text.slice(end)}`,
					newStart: start,
					newEnd: end + 2,
				};
			}
			return {
				newText: `${text.slice(0, start)}\`code\`${text.slice(end)}`,
				newStart: start + 1,
				newEnd: start + 5,
			};
		});
	}, [applyFormatting]);

	const handleCodeBlock = useCallback(() => {
		applyFormatting((text, start, end) => {
			const selected = text.slice(start, end);
			if (selected) {
				return {
					newText:
						text.slice(0, start) +
						"```\n" +
						selected +
						"\n```" +
						text.slice(end),
					newStart: start,
					newEnd: end + 8,
				};
			}
			return {
				newText: `${text.slice(0, start)}\`\`\`\n\n\`\`\`${text.slice(end)}`,
				newStart: start + 4,
				newEnd: start + 4,
			};
		});
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
		applyFormatting((text, start, end) => {
			const lineStart = findLineStart(text, start);
			const prefix = "- ";
			return {
				newText: text.slice(0, lineStart) + prefix + text.slice(lineStart),
				newStart: start + prefix.length,
				newEnd: end + prefix.length,
			};
		});
	}, [applyFormatting]);

	const handleOrderedList = useCallback(() => {
		applyFormatting((text, start, end) => {
			const lineStart = findLineStart(text, start);
			const prefix = "1. ";
			return {
				newText: text.slice(0, lineStart) + prefix + text.slice(lineStart),
				newStart: start + prefix.length,
				newEnd: end + prefix.length,
			};
		});
	}, [applyFormatting]);

	const handleTaskList = useCallback(() => {
		applyFormatting((text, start, end) => {
			const lineStart = findLineStart(text, start);
			const prefix = "- [ ] ";
			return {
				newText: text.slice(0, lineStart) + prefix + text.slice(lineStart),
				newStart: start + prefix.length,
				newEnd: end + prefix.length,
			};
		});
	}, [applyFormatting]);

	const handleBlockquote = useCallback(() => {
		applyFormatting((text, start, end) => {
			const lineStart = findLineStart(text, start);
			const prefix = "> ";
			return {
				newText: text.slice(0, lineStart) + prefix + text.slice(lineStart),
				newStart: start + prefix.length,
				newEnd: end + prefix.length,
			};
		});
	}, [applyFormatting]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
		[handleBold, handleItalic, handleLink, handleCodeBlock, onSubmit, onCancel],
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
		<div className={`rounded-lg border border-gray-300 ${className}`}>
			<div className="-mb-px flex items-center gap-6 rounded-t-lg border-gray-300 border-b bg-gray-50 px-3">
				<button
					className={`border-b-2 px-1 py-2 font-medium text-sm cursor-pointer ${mode === "write"
						? "border-blue-500 text-blue-600"
						: "border-transparent text-gray-600 hover:text-gray-800"
						}`}
					onClick={() => setMode("write")}
					type="button"
				>
					Write
				</button>
				<button
					className={`border-b-2 px-1 py-2 font-medium text-sm cursor-pointer ${mode === "preview"
						? "border-blue-500 text-blue-600"
						: "border-transparent text-gray-600 hover:text-gray-800"
						}`}
					onClick={() => setMode("preview")}
					type="button"
				>
					Preview
				</button>
			</div>

			{mode === "write" ? (
				<>
					<div className="flex flex-wrap items-center gap-0.5 border-gray-300 border-b px-3 py-1.5">
						{toolbarGroups.map((group, gi) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: toolbar groups are static
							<span className="flex items-center gap-0.5" key={gi}>
								{gi > 0 && (
									<span className="mx-1 select-none text-gray-300">|</span>
								)}
								{group.map((btn) => (
									<button
										className="inline-flex items-center justify-center rounded-md px-1.5 py-1 font-medium text-gray-600 text-sm hover:bg-gray-200 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
										disabled={disabled}
										key={btn.label}
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

					<textarea
						className="w-full resize-y rounded-b-lg border-0 px-3 py-2 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-0 disabled:bg-gray-50"
						disabled={disabled}
						onChange={(e) => onChange(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder={placeholder}
						ref={textareaRef}
						style={{ minHeight }}
						value={value}
					/>
				</>
			) : (
				<div
					className="prose prose-sm max-w-none px-3 py-2"
					style={{ minHeight }}
				>
					<MarkdownRenderer content={value} />
				</div>
			)}

			{(onSubmit || onCancel) && (
				<div className="flex items-center justify-end gap-2 border-gray-300 border-t px-3 py-2">
					{onCancel && (
						<button
							className="rounded-md border border-gray-300 px-4 py-1.5 font-medium text-gray-600 text-sm transition-colors hover:bg-gray-100 hover:text-gray-800 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
							disabled={disabled}
							onClick={onCancel}
							type="button"
						>
							{cancelLabel}
						</button>
					)}
					{onSubmit && (
						<button
							className="rounded-md bg-[#2da44e] px-4 py-1.5 font-medium text-sm text-white transition-colors hover:bg-[#218838] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
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
