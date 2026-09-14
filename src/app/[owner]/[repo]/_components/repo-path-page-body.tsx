"use client";

import type { ReactNode } from "react";
import { Async } from "~/components/async";
import type { RepoData } from "./repo-page-types";

interface RepoPathPageBodyProps {
    repoDataPromise: Promise<RepoData>;
    /** Shown while the repo query resolves, in place of `children`. */
    contentFallback: ReactNode;
    children: ReactNode;
}

/**
 * Main column of the file and directory pages: the page container and the
 * boundary that waits for the repository. No repo name header and no About
 * column, and no `<main>`, which the resizable layout supplies.
 */
export function RepoPathPageBody({
    repoDataPromise,
    contentFallback,
    children,
}: RepoPathPageBodyProps) {
    return (
        <div className="mx-auto min-h-[calc(100svh-var(--header-height))] max-w-7xl px-6 py-6">
            <Async promise={repoDataPromise} fallback={contentFallback}>
                {() => children}
            </Async>
        </div>
    );
}
