"use client";

import type { DiffViewMode } from "~/utils/diff-view";

export function DiffContextRow({
    lineNum,
    content,
    id,
    highlighted,
    onLineSelect,
    onLineMouseDown,
    view = "unified",
}: {
    lineNum: number;
    content: string;
    id?: string;
    highlighted?: boolean;
    onLineSelect?: (
        line: number,
        side: "LEFT" | "RIGHT",
        shiftKey: boolean,
    ) => void;
    onLineMouseDown?: (line: number, side: "LEFT" | "RIGHT") => void;
    view?: DiffViewMode;
}) {
    if (view === "split") {
        return (
            <tr
                id={id}
                className={highlighted ? "line-highlighted" : undefined}
            >
                <td
                    className="d2h-code-linenumber d2h-split-ln d2h-cntx"
                    onMouseDown={() => onLineMouseDown?.(lineNum, "LEFT")}
                    onClick={(event) =>
                        onLineSelect?.(lineNum, "LEFT", event.shiftKey)
                    }
                    title="Copy permalink"
                >
                    <div className="absolute inset-0">
                        <span className="d2h-split-ln-num">{lineNum}</span>
                    </div>
                </td>
                <td className="d2h-split-code d2h-cntx">
                    <div className="d2h-split-code-line">
                        <span className="d2h-code-line-ctn">
                            {content || <br />}
                        </span>
                    </div>
                </td>
                <td
                    className="d2h-code-linenumber d2h-split-ln d2h-split-new d2h-cntx"
                    onMouseDown={() => onLineMouseDown?.(lineNum, "RIGHT")}
                    onClick={(event) =>
                        onLineSelect?.(lineNum, "RIGHT", event.shiftKey)
                    }
                    title="Copy permalink"
                >
                    <div className="absolute inset-0">
                        <span className="d2h-split-ln-num">{lineNum}</span>
                    </div>
                </td>
                <td className="d2h-split-code d2h-cntx">
                    <div className="d2h-split-code-line">
                        <span className="d2h-code-line-ctn">
                            {content || <br />}
                        </span>
                    </div>
                </td>
            </tr>
        );
    }
    return (
        <tr id={id} className={highlighted ? "line-highlighted" : undefined}>
            <td
                className="d2h-code-linenumber d2h-cntx"
                onMouseDown={() => onLineMouseDown?.(lineNum, "RIGHT")}
                onClick={(event) =>
                    onLineSelect?.(lineNum, "RIGHT", event.shiftKey)
                }
                title="Copy permalink"
            >
                <div className="absolute">
                    <div className="line-num1">{lineNum}</div>
                    <div className="line-num2">{lineNum}</div>
                </div>
            </td>
            <td className="d2h-cntx">
                <div className="d2h-code-line" style={{ display: "flex" }}>
                    <span className="d2h-code-line-ctn">
                        {content || <br />}
                    </span>
                </div>
            </td>
        </tr>
    );
}
