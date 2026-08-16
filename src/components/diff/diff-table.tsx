"use client";

import type { ReactNode, RefObject } from "react";
import type { DiffViewMode } from "~/utils/diff-view";

export interface DiffTableProps {
    children: ReactNode;
    diffRef: RefObject<HTMLDivElement | null>;
    colorScheme: "light" | "dark";
    onMouseOver: (event: React.MouseEvent<HTMLTableSectionElement>) => void;
    view?: DiffViewMode;
}

export function DiffTable({
    children,
    diffRef,
    colorScheme,
    onMouseOver,
    view = "unified",
}: DiffTableProps) {
    return (
        <div className="overflow-x-auto">
            <style>{`
                tr.line-highlighted td {
                    background-color: rgba(251, 146, 60, 0.2) !important;
                }
                /* Split view: selection highlight applies to one side's cells
                   only (the side whose line is in the selected range). */
                .d2h-split-table td.d2h-split-selected {
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
                /* Split (side-by-side) view: four fixed columns like GitHub —
                   old line number, old content, new line number, new content.
                   The empty side of an unpaired change keeps the table
                   background; changed line numbers use a stronger tint than
                   the code cells. */
                .d2h-split-table {
                    table-layout: fixed;
                }
                /* In fixed layout the first row's cells define the columns;
                   an unfold row spans the content columns with colSpan=3,
                   which would give the right line-number column the same
                   width as the content columns. Explicit col widths keep the
                   two line-number columns equal and the content columns
                   balanced regardless of which row comes first. */
                .d2h-split-table col.d2h-split-ln-col {
                    width: 4em;
                }
                .d2h-split-table .d2h-code-linenumber {
                    position: relative;
                    display: table-cell;
                    width: 4em;
                    direction: ltr;
                    border-width: 0;
                }
                .d2h-split-table .d2h-split-ln-num {
                    display: block;
                    padding: 0 0.6em;
                    text-align: right;
                }
                .d2h-split-table td.d2h-split-code {
                    vertical-align: top;
                }
                .d2h-split-table .d2h-split-code-line {
                    display: block;
                    padding: 0 0.75em;
                    white-space: pre-wrap;
                    word-break: break-word;
                }
                .d2h-split-table td.d2h-split-ln.d2h-split-new {
                    border-left: 1px solid #d8dee4;
                }
                .d2h-split-table td.d2h-split-ln.d2h-del {
                    background-color: #ffd7d5;
                }
                .d2h-split-table td.d2h-split-ln.d2h-ins {
                    background-color: #ccffd8;
                }
                .d2h-dark-color-scheme
                    .d2h-split-table
                    td.d2h-split-ln.d2h-split-new {
                    border-left-color: rgba(61, 68, 77, 0.7);
                }
                .d2h-dark-color-scheme
                    .d2h-split-table
                    td.d2h-split-ln.d2h-del {
                    background-color: rgba(248, 81, 73, 0.3);
                }
                .d2h-dark-color-scheme
                    .d2h-split-table
                    td.d2h-split-ln.d2h-ins {
                    background-color: rgba(63, 185, 80, 0.3);
                }
            `}</style>
            <div
                className={`d2h-wrapper ${colorScheme === "light" ? "d2h-light-color-scheme" : "d2h-dark-color-scheme"}`}
                ref={diffRef}
            >
                <table
                    className={`d2h-diff-table ${view === "split" ? "d2h-split-table relative" : "relative"}`}
                >
                    {view === "split" && (
                        <colgroup>
                            <col className="d2h-split-ln-col" />
                            <col />
                            <col className="d2h-split-ln-col" />
                            <col />
                        </colgroup>
                    )}
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
