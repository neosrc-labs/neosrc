"use client";

import type { ReactNode, RefObject } from "react";

export interface DiffTableProps {
    children: ReactNode;
    diffRef: RefObject<HTMLDivElement | null>;
    colorScheme: "light" | "dark";
    onMouseOver: (event: React.MouseEvent<HTMLTableSectionElement>) => void;
}

export function DiffTable({
    children,
    diffRef,
    colorScheme,
    onMouseOver,
}: DiffTableProps) {
    return (
        <div className="overflow-x-auto">
            <style>{`
                tr.line-highlighted td {
                    background-color: rgba(251, 146, 60, 0.2) !important;
                }
                tr[id^="diff-"] {
                    scroll-margin-top: var(--diff-scroll-offset, 0px);
                }
                .d2h-code-line {
                    white-space: pre-wrap;
                }
                .d2h-code-line-ctn {
                    white-space: pre-wrap;
                }
                .d2h-ins,
                .d2h-del,
                .d2h-cntx {
                    word-break: break-word;
                }
            `}</style>
            <div
                className={`d2h-wrapper ${colorScheme === "light" ? "d2h-light-color-scheme" : "d2h-dark-color-scheme"}`}
                ref={diffRef}
            >
                <table className="d2h-diff-table relative">
                    <tbody
                        className="d2h-diff-tbody"
                        onMouseOver={onMouseOver}
                        onFocus={() => {}}
                    >
                        {children}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
