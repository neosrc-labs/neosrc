"use client";

import { useTheme } from "next-themes";
import { useMemo, useRef } from "react";
import { useFileContent } from "~/hooks/use-file-content";
import type { ReviewCommentBase } from "~/server/github";
import { DiffTable } from "./diff/diff-table";
import { getDiffLanguage } from "./diff/model";
import { useDiffSyntaxHighlighting } from "./diff/use-diff-syntax-highlighting";
import {
    fileSnippetRows,
    hunkSnippetRows,
    type SnippetRow,
    snippetAnchor,
} from "./review-comment-snippet-utils";

// The unified diff renders inserts and deletes with the change variants, so
// the snippet carries the same tints as the file it was written against.
const ROW_CLASS: Record<SnippetRow["kind"], string> = {
    context: "d2h-cntx",
    insert: "d2h-ins d2h-change",
    delete: "d2h-del d2h-change",
};

const NOOP = () => {};

/**
 * The few lines of code a review comment was written against, shown above the
 * thread in the timeline. Rendered through the same diff table as the
 * file-changed page, so type, tints, line numbers, and syntax highlighting all
 * line up. Comments on lines outside the diff carry no hunk from GitHub, so
 * those read the file at the comment's commit instead.
 */
export function ReviewCommentSnippet({
    comment,
    owner,
    repo,
}: {
    comment: ReviewCommentBase;
    owner: string;
    repo: string;
}) {
    const anchor = useMemo(() => snippetAnchor(comment), [comment]);
    const hunkRows = useMemo(
        () => (anchor ? hunkSnippetRows(comment.diff_hunk, anchor) : []),
        [comment.diff_hunk, anchor],
    );

    // Old-side numbering does not address the file at `sha`, so LEFT comments
    // have nothing to fall back to.
    const needsFile =
        anchor != null &&
        hunkRows.length === 0 &&
        anchor.side === "RIGHT" &&
        anchor.sha.length > 0;
    const { lines } = useFileContent({
        owner: needsFile ? owner : undefined,
        repo: needsFile ? repo : undefined,
        sha: needsFile ? anchor.sha : undefined,
        path: needsFile ? comment.path : undefined,
    });

    const rows = useMemo(() => {
        if (hunkRows.length > 0) {
            return hunkRows;
        }
        if (!needsFile || !lines || !anchor) {
            return [];
        }
        return fileSnippetRows(lines, anchor);
    }, [hunkRows, needsFile, lines, anchor]);

    const diffRef = useRef<HTMLDivElement>(null);
    const { resolvedTheme } = useTheme();
    const language = useMemo(
        () => getDiffLanguage(comment.path),
        [comment.path],
    );
    useDiffSyntaxHighlighting({
        diffRef,
        language,
        enabled: rows.length > 0,
    });

    if (rows.length === 0) {
        return null;
    }

    return (
        <div
            data-testid="review-comment-snippet"
            className="border-border border-b bg-surface"
        >
            <DiffTable
                colorScheme={resolvedTheme === "dark" ? "dark" : "light"}
                diffRef={diffRef}
                onMouseOver={NOOP}
            >
                {rows.map((row) => (
                    <tr key={`${row.kind}-${row.oldNumber}-${row.newNumber}`}>
                        <td
                            className={`d2h-code-linenumber ${ROW_CLASS[row.kind]}`}
                            // The diff's number cell copies a permalink; the
                            // snippet has nothing to click.
                            style={{ cursor: "default" }}
                        >
                            <div className="d2h-ln-overlay absolute">
                                <div className="line-num1">
                                    {row.oldNumber ?? ""}
                                </div>
                                <div className="line-num2">
                                    {row.newNumber ?? ""}
                                </div>
                            </div>
                        </td>
                        <td className={ROW_CLASS[row.kind]}>
                            <div
                                className="d2h-code-line"
                                style={{
                                    display: "flex",
                                    width: "100%",
                                    paddingRight: "8px",
                                }}
                            >
                                <span className="d2h-code-line-ctn">
                                    {row.content || <br />}
                                </span>
                            </div>
                        </td>
                    </tr>
                ))}
            </DiffTable>
        </div>
    );
}
