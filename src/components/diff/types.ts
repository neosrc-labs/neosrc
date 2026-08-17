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
