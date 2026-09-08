"use client";

import { useMemo } from "react";
import { useFileContent } from "~/hooks/use-file-content";
import type { ReviewCommentBase } from "~/server/github";
import {
    fileSnippetRows,
    hunkSnippetRows,
    type SnippetRow,
    snippetAnchor,
} from "./review-comment-snippet-utils";

const ROW_CLASS: Record<SnippetRow["kind"], string> = {
    context: "",
    insert: "bg-green-500/10",
    delete: "bg-red-500/10",
};

const PREFIX: Record<SnippetRow["kind"], string> = {
    context: " ",
    insert: "+",
    delete: "-",
};

/**
 * The few lines of code a review comment was written against, shown above the
 * thread in the timeline. Comments on lines outside the diff carry no hunk
 * from GitHub, so those read the file at the comment's commit instead.
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

    if (rows.length === 0) {
        return null;
    }

    return (
        <div
            data-testid="review-comment-snippet"
            className="overflow-x-auto border-border border-b"
        >
            <table className="w-full border-collapse font-mono text-text-secondary text-xs leading-5">
                <tbody>
                    {rows.map((row) => (
                        <tr
                            key={`${row.kind}-${row.lineNumber}`}
                            className={ROW_CLASS[row.kind]}
                        >
                            <td className="w-12 select-none py-0 pr-2 text-right align-top text-text-muted">
                                {row.lineNumber}
                            </td>
                            <td className="py-0 pr-4 align-top">
                                <span className="select-none pr-1 text-text-muted">
                                    {PREFIX[row.kind]}
                                </span>
                                <span className="whitespace-pre-wrap break-all">
                                    {row.content || " "}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
