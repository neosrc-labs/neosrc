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
    startLine: number;
    endLine: number;
}

/** How many lines of a gap are revealed from each end. */
export interface GapExpansion {
    /** Lines revealed from the top of the gap (expand-down clicks). */
    top: number;
    /** Lines revealed from the bottom of the gap (expand-up clicks). */
    bottom: number;
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
    commentDragRange: {
        startLine: number;
        endLine: number;
        side: DiffSide;
    } | null;
    onCommentDragStart?: (
        line: number,
        side: DiffSide,
        lines?: { oldLine?: number; newLine?: number },
    ) => void;
    pendingReviewId?: number | null;
    permissionContext: PullRequestPermissionContext;
}
