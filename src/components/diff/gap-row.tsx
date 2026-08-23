"use client";

import { ArrowDownFromLine } from "lucide-react";
import { useFileContent } from "~/hooks/use-file-content";
import type { ReviewComment } from "~/server/github";
import type { DiffViewMode } from "~/utils/diff-view";
import {
    type DiffRowNavigationProps,
    GAP_EXPAND_STEP,
} from "./diff-block-rows";
import { DiffContextRow } from "./diff-context-row";
import type { DiffAnchor, DiffRowCommentProps, GapExpansion } from "./types";

interface GapRowProps extends DiffRowNavigationProps {
    startLine: number;
    oldStartLine: number;
    expandedCount: number;
    onExpand: (key: string, expansion: GapExpansion) => void;
    gapKey: string;
    owner: string | undefined;
    repo: string | undefined;
    headSha: string | undefined;
    filename: string;
    view: DiffViewMode;
    commentsByLine: Map<string, ReviewComment[]>;
    positionMap: Map<number, DiffAnchor>;
    multiLineRanges: Map<string, string[]>;
    commentProps: DiffRowCommentProps;
}

export function GapRow({
    startLine,
    oldStartLine,
    expandedCount,
    onExpand,
    gapKey,
    owner,
    repo,
    headSha,
    filename,
    fileHash,
    view,
    selectedRange,
    onLineSelect,
    onLineMouseDown,
    commentsByLine,
    positionMap,
    multiLineRanges,
    commentProps,
}: GapRowProps) {
    const { lines, isLoading, error } = useFileContent({
        owner,
        repo,
        sha: headSha,
        path: filename,
    });

    const endLine = lines?.length ?? -1;
    const gapSize = endLine - startLine + 1;
    const contentColSpan = view === "split" ? 3 : 1;

    if (expandedCount === 0) {
        // If we are loading, show the expand button since there is a good chance the edited line
        // is not the last line in the file and we want to avoid layout shifts.
        if (!isLoading && gapSize <= 0) return null;
        if (!headSha) return null;
        return (
            <tr>
                <td className="d2h-code-linenumber d2h-info">
                    <button
                        type="button"
                        title="Expand lines below"
                        aria-label="Expand lines below"
                        onClick={() =>
                            onExpand(gapKey, {
                                top:
                                    gapSize > 0
                                        ? Math.min(GAP_EXPAND_STEP, gapSize)
                                        : GAP_EXPAND_STEP,
                                bottom: 0,
                            })
                        }
                        className="absolute inset-0 flex w-full cursor-pointer items-center justify-center text-text-tertiary transition-colors hover:bg-surface-selected hover:text-text-label"
                    >
                        <ArrowDownFromLine size={14} />
                    </button>
                </td>
                <td className="d2h-info" colSpan={contentColSpan}>
                    <div className="d2h-code-line" />
                </td>
            </tr>
        );
    }

    if (isLoading) {
        return (
            <tr>
                <td className="d2h-code-linenumber d2h-info" />
                <td className="d2h-info" colSpan={contentColSpan}>
                    <div className="d2h-code-line text-text-muted text-xs">
                        Loading...
                    </div>
                </td>
            </tr>
        );
    }

    if (error || !lines || gapSize <= 0) {
        return null;
    }

    const gapLines = lines.slice(
        startLine - 1,
        startLine - 1 + Math.min(expandedCount, gapSize),
    );

    return (
        <>
            {gapLines.map((lineContent, idx) => {
                const lineNum = startLine + idx;
                return (
                    <DiffContextRow
                        key={`gap-${lineNum}`}
                        lineNum={lineNum}
                        oldLine={oldStartLine + idx}
                        content={lineContent}
                        id={`diff-${fileHash}R${lineNum}`}
                        selectedRange={selectedRange}
                        onLineSelect={onLineSelect}
                        onLineMouseDown={onLineMouseDown}
                        view={view}
                        fileHash={fileHash}
                        owner={owner}
                        repo={repo}
                        commentsByLine={commentsByLine}
                        positionMap={positionMap}
                        multiLineRanges={multiLineRanges}
                        commentProps={commentProps}
                    />
                );
            })}
            {expandedCount < gapSize && (
                <tr>
                    <td className="d2h-code-linenumber d2h-info">
                        <button
                            type="button"
                            title="Expand lines below"
                            aria-label="Expand lines below"
                            onClick={() =>
                                onExpand(gapKey, {
                                    top: Math.min(
                                        expandedCount + GAP_EXPAND_STEP,
                                        gapSize,
                                    ),
                                    bottom: 0,
                                })
                            }
                            className="absolute inset-0 flex w-full cursor-pointer items-center justify-center text-text-tertiary transition-colors hover:bg-surface-selected hover:text-text-label"
                        >
                            <ArrowDownFromLine size={14} />
                        </button>
                    </td>
                    <td className="d2h-info" colSpan={contentColSpan}>
                        <div className="d2h-code-line" />
                    </td>
                </tr>
            )}
        </>
    );
}
