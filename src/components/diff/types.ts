import type { DiffBlock } from "diff2html/lib/types";
import type { PullRequestPermissionContext } from "~/app/gh/[owner]/[repo]/pull/[number]/permissions-utils";
import type { FooterAction } from "../markdown/markdown-editor";

export type DiffSide = "LEFT" | "RIGHT";

export type DiffCommentTarget =
    | {
          type: "line";
          line: number;
          side: DiffSide;
          startLine?: number;
          startSide?: DiffSide;
      }
    | { type: "file" };

export interface DiffAnchor {
    side: DiffSide;
    line: number;
}

export interface DiffGap {
    /** First line of the gap in new-file coordinates. */
    startLine: number;
    /** Last line of the gap in new-file coordinates (-1 = open-ended). */
    endLine: number;
    /**
     * Old-file number of the gap's first line. Between hunks the files are
     * identical, so old and new numbers differ by a constant offset within
     * the gap; gap lines are context lines present on both sides.
     */
    oldStartLine: number;
}

/** Inclusive run of revealed gap lines, in new-file coordinates. */
export interface GapRange {
    start: number;
    end: number;
}

/** A run of gap lines in render order; hidden runs carry an unfold row. */
export interface GapSegment extends GapRange {
    hidden: boolean;
}

export type DiffRenderItem =
    | { type: "block"; block: DiffBlock }
    | ({ type: "gap" } & DiffGap);

/** Comment-related props threaded through the diff table rows. */
export interface DiffRowCommentProps {
    activeComment: DiffCommentTarget | null;
    onStartComment: ((ac: DiffCommentTarget | null) => void) | undefined;
    pullNumber: number | string | undefined;
    commentBody: string;
    onCommentBodyChange: ((body: string) => void) | undefined;
    footerActions?: FooterAction[];
    commentPending: boolean;
    commentError: boolean;
    onCancelComment: (() => void) | undefined;
    showComments: boolean;
    showCommentButton: boolean;
    onCommentDragStart?: (
        line: number,
        side: DiffSide,
        lines?: { oldLine?: number; newLine?: number },
    ) => void;
    pendingReviewId?: number | null;
    permissionContext: PullRequestPermissionContext;
}
