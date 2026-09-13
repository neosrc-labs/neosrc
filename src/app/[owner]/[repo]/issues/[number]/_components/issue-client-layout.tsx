"use client";

import type { ReactNode } from "react";
import { ResizableLayout } from "~/components/resizable-layout";

export type IssueClientLayoutProps = {
    leftSidebar: ReactNode;
    rightSidebar: ReactNode;
    children: ReactNode;
};

// Thin client wrapper for `ResizableLayout`. Issues have no files-changed
// view, so the layout is always boxed.
export function IssueClientLayout({
    rightSidebar,
    leftSidebar,
    children,
}: IssueClientLayoutProps) {
    return (
        <ResizableLayout
            boxed
            leftSidebar={leftSidebar}
            rightSidebar={rightSidebar}
        >
            {children}
        </ResizableLayout>
    );
}
