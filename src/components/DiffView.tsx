"use client";

import { defaultDiff2HtmlConfig, parse } from "diff2html";
import type { ColorSchemeType } from "diff2html/lib/types";
import "diff2html/bundles/css/diff2html.min.css";
import type { DiffBlock } from "diff2html/lib/types";
import hljs from "highlight.js";
import { SquarePlus, UnfoldVertical } from "lucide-react";
import { useTheme } from "next-themes";
import {
    Fragment,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useFileContent } from "~/hooks/useFileContent";
import type { ReviewComment } from "~/server/github";
import { InlineCommentThread } from "./InlineCommentThread";
import type { FooterAction } from "./markdown/MarkdownEditor";
import { MarkdownEditor } from "./markdown/MarkdownEditor";

export interface ActiveComment {
    line: number;
    side: "LEFT" | "RIGHT";
}

interface DiffViewProps {
    patch: string;
    filename: string;
    comments?: ReviewComment[];
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
    headSha?: string;
    expandAllContext?: boolean;
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
    headSha,
    expandAllContext = false,
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

    const [expandedGapKeys, setExpandedGapKeys] = useState<Set<string>>(
        () => new Set(),
    );

    const handleGapExpand = useCallback((key: string) => {
        setExpandedGapKeys((prev) => {
            const next = new Set(prev);
            next.add(key);
            return next;
        });
    }, []);

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
        // Re-run when gap expansions add new .d2h-code-line-ctn elements to the DOM
        void expandedGapKeys;
        void expandAllContext;
    }, [language, parsed, expandedGapKeys, expandAllContext]);

    const commentsByLine = useMemo(() => {
        const map = new Map<string, ReviewComment[]>();
        for (const comment of comments) {
            const line = comment.line ?? comment.position ?? 0;
            const side = comment.side ?? "RIGHT";
            const key = `${line}-${side}`;
            const existing = map.get(key) ?? [];
            existing.push(comment);
            map.set(key, existing);
        }
        return map;
    }, [comments]);

    const renderItems = useMemo(() => {
        if (!parsed?.blocks) return [];
        const items: Array<
            { type: "block"; block: DiffBlock } | ({ type: "gap" } & Gap)
        > = [];

        for (let i = 0; i < parsed.blocks.length; i++) {
            const block = parsed.blocks[i];
            if (!block) continue;

            if (i === 0 && block.newStartLine > 1) {
                items.push({
                    type: "gap",
                    startLine: 1,
                    endLine: block.newStartLine - 1,
                });
            }

            if (i > 0) {
                const prevBlock = parsed.blocks[i - 1];
                if (!prevBlock) continue;
                const g = computeBetweenGap(prevBlock, block);
                if (g) {
                    items.push({ type: "gap", ...g });
                }
            }

            items.push({ type: "block", block });

            if (i === parsed.blocks.length - 1) {
                const leading = getLastNewLine(block) + 1;
                items.push({
                    type: "gap",
                    startLine: leading,
                    endLine: -1,
                });
            }
        }

        return items;
    }, [parsed]);

    if (!parsed) {
        return null;
    }

    return (
        <div className="overflow-x-auto">
            <div
                className={`d2h-wrapper ${resolvedTheme === "light" ? "d2h-light-color-scheme" : "d2h-dark-color-scheme"}`}
                ref={diffRef}
            >
                <table className="d2h-diff-table relative">
                    <tbody className="d2h-diff-tbody">
                        {renderItems.map((item, idx) => {
                            if (item.type === "gap") return null;

                            const prevItem =
                                idx > 0 ? renderItems[idx - 1] : null;
                            const prevGap =
                                prevItem?.type === "gap" ? prevItem : null;
                            const isEdgeGap =
                                prevGap !== null &&
                                (prevGap.startLine === 1 ||
                                    prevGap.endLine === -1);
                            const shouldShowGap =
                                prevGap && (!isEdgeGap || expandAllContext);
                            const prevGapKey =
                                shouldShowGap && prevGap
                                    ? `gap-${prevGap.startLine}`
                                    : undefined;
                            const isGapExpanded =
                                shouldShowGap === true &&
                                prevGapKey !== undefined &&
                                (expandAllContext ||
                                    expandedGapKeys.has(prevGapKey));

                            return (
                                <BlockRows
                                    key={`block-${item.block.newStartLine}`}
                                    block={item.block}
                                    hideHeader={isGapExpanded}
                                    gap={shouldShowGap ? prevGap : undefined}
                                    gapKey={prevGapKey}
                                    isGapExpanded={isGapExpanded}
                                    onGapExpand={handleGapExpand}
                                    headSha={headSha}
                                    filename={filename}
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
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

type Gap = { startLine: number; endLine: number };

function getLastNewLine(block: DiffBlock): number {
    let last = block.newStartLine;
    for (const line of block.lines) {
        if (line.newNumber !== undefined) {
            last = line.newNumber;
        }
    }
    return last;
}

function computeBetweenGap(
    prevBlock: DiffBlock,
    curBlock: DiffBlock,
): Gap | null {
    const prevLastNew = getLastNewLine(prevBlock);
    const gapStart = prevLastNew + 1;
    const gapEnd = curBlock.newStartLine - 1;
    if (gapStart <= gapEnd) {
        return { startLine: gapStart, endLine: gapEnd };
    }
    return null;
}

function groupThreads(
    comments: ReviewComment[],
): Array<{ parent: ReviewComment; replies: ReviewComment[] }> {
    const threads = new Map<number, ReviewComment[]>();
    for (const comment of comments) {
        const rootId = comment.in_reply_to_id ?? comment.id;
        const existing = threads.get(rootId) ?? [];
        existing.push(comment);
        threads.set(rootId, existing);
    }
    return Array.from(threads.entries()).map(([, group]) => ({
        parent: group[0] as ReviewComment,
        replies: group.slice(1),
    }));
}

interface BlockRowsProps {
    block: NonNullable<ReturnType<typeof parse>>[number]["blocks"][number];
    commentsByLine: Map<string, ReviewComment[]>;
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
    hideHeader?: boolean;
    gap?: Gap;
    gapKey?: string;
    isGapExpanded?: boolean;
    onGapExpand?: (key: string) => void;
    headSha?: string;
    filename?: string;
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
    hideHeader,
    gap,
    gapKey,
    isGapExpanded,
    onGapExpand,
    headSha,
    filename,
}: BlockRowsProps) {
    const {
        lines: fileLines,
        isLoading,
        error,
    } = useFileContent({
        owner: owner ?? "",
        repo: repo ?? "",
        sha: headSha ?? "",
        path: filename ?? "",
    });

    const gapEnd =
        gap?.endLine === -1 ? (fileLines?.length ?? -1) : (gap?.endLine ?? -1);
    const gapSize = gap ? gapEnd - gap.startLine + 1 : 0;

    return (
        <>
            {isGapExpanded && gap && isLoading && (
                <tr>
                    <td className="d2h-code-linenumber d2h-info" />
                    <td className="d2h-info">
                        <div className="d2h-code-line text-gray-400 text-xs">
                            Loading...
                        </div>
                    </td>
                </tr>
            )}
            {isGapExpanded &&
                gap &&
                !isLoading &&
                !error &&
                fileLines &&
                gapSize > 0 &&
                fileLines
                    .slice(gap.startLine - 1, gapEnd)
                    .map((lineContent, idx) => {
                        const lineNum = gap.startLine + idx;
                        return (
                            <tr key={`gap-${lineNum}`}>
                                <td className="d2h-code-linenumber d2h-cntx">
                                    <div className="absolute">
                                        <div className="line-num1">
                                            {lineNum}
                                        </div>
                                        <div className="line-num2">
                                            {lineNum}
                                        </div>
                                    </div>
                                </td>
                                <td className="d2h-cntx">
                                    <div
                                        className="d2h-code-line"
                                        style={{ display: "flex" }}
                                    >
                                        <span className="d2h-code-line-ctn">
                                            {lineContent || <br />}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
            {!hideHeader && (
                <tr
                    className={
                        gap && !isGapExpanded && gapSize > 0
                            ? "cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30"
                            : ""
                    }
                    onClick={() => {
                        if (gap && !isGapExpanded && gapSize > 0) {
                            onGapExpand?.(gapKey ?? "");
                        }
                    }}
                >
                    <td className="d2h-code-linenumber d2h-info">
                        {gap && !isGapExpanded && gapSize > 0 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <UnfoldVertical
                                    size={14}
                                    className="text-gray-500 dark:text-gray-400"
                                />
                            </div>
                        )}
                    </td>
                    <td className="d2h-info">
                        <div className="d2h-code-line">{block.header}</div>
                    </td>
                </tr>
            )}
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

                const lineComments =
                    commentsByLine.get(`${commentLine}-${side}`) ?? [];
                const isActive =
                    activeComment?.line === commentLine &&
                    activeComment?.side === side;
                const hasComments = lineComments.length > 0;

                const content = line.content.slice(1);

                return (
                    <Fragment
                        key={`${oldNum ?? ""}-${newNum ?? ""}-${line.content}`}
                    >
                        <tr className="group">
                            <td className={`d2h-code-linenumber ${typeClass}`}>
                                <div className="absolute">
                                    {showCommentButton && onStartComment && (
                                        <SquarePlus
                                            size={24}
                                            className="absolute -right-5 z-10 hidden rounded-md bg-blue-500 p-0.5 text-white group-hover:block"
                                            onClick={() =>
                                                onStartComment(
                                                    isActive
                                                        ? null
                                                        : {
                                                              line: commentLine,
                                                              side,
                                                          },
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
                                <div
                                    className="d2h-code-line"
                                    style={{ display: "flex" }}
                                >
                                    <span className="d2h-code-line-ctn">
                                        {content || <br />}
                                    </span>
                                </div>
                            </td>
                        </tr>
                        {showComments &&
                            hasComments &&
                            groupThreads(lineComments).map((thread) => (
                                <tr key={`thread-${thread.parent.id}`}>
                                    <td
                                        colSpan={2}
                                        className="p-0 dark:bg-zinc-950"
                                    >
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
                            ))}
                        {isActive && (
                            <tr>
                                <td
                                    colSpan={2}
                                    className="border-gray-200 border-t p-2 dark:border-gray-700"
                                >
                                    <MarkdownEditor
                                        autoFocus
                                        disabled={commentPending}
                                        onChange={
                                            onCommentBodyChange ?? (() => {})
                                        }
                                        onCancel={onCancelComment ?? (() => {})}
                                        placeholder="Add a comment..."
                                        value={commentBody}
                                        owner={owner ?? ""}
                                        repo={repo ?? ""}
                                        footerActions={footerActions}
                                    />
                                    {commentError && (
                                        <p className="mt-1 text-red-600 text-xs">
                                            Failed to post comment. Please try
                                            again.
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
