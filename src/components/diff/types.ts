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

export type DiffRenderItem =
    | { type: "block"; block: DiffBlock }
    | ({ type: "gap" } & DiffGap);
