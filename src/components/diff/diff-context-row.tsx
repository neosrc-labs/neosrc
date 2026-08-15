"use client";

export function DiffContextRow({
    lineNum,
    content,
    id,
    highlighted,
    onLineSelect,
    onLineMouseDown,
}: {
    lineNum: number;
    content: string;
    id?: string;
    highlighted?: boolean;
    onLineSelect?: (line: number, side: "RIGHT", shiftKey: boolean) => void;
    onLineMouseDown?: (line: number, side: "RIGHT") => void;
}) {
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
