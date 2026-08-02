"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ResizableLayout } from "~/components/ResizableLayout";
import { isChangesPage } from "~/utils/route";

export type PullRequestClientLayoutProps = {
    leftSidebar: ReactNode;
    rightSidebar: ReactNode;
    children: ReactNode;
};

// Thin client wrapper for `ResizableLayout` that computes the `boxed` attribute for the PR related pages.
export function PullRequestClientLayout({
    rightSidebar,
    leftSidebar,
    children,
}: PullRequestClientLayoutProps) {
    const pathname = usePathname();
    return (
        <ResizableLayout
            boxed={!isChangesPage(pathname)}
            leftSidebar={leftSidebar}
            rightSidebar={rightSidebar}
        >
            {children}
        </ResizableLayout>
    );
}
