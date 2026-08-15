import type { DiffBlock } from "diff2html/lib/types";

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
