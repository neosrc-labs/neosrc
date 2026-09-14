"use client";

import { type ReactNode, useEffect } from "react";
import { ResizableLayout } from "~/components/resizable-layout";
import { useSidebar } from "~/components/sidebar-context";
import type { Provider } from "~/utils/provider-url";
import { RefSelector } from "./ref-selector";
import { RepoFileSearch } from "./repo-file-search";
import { RepoFileTree } from "./repo-file-tree";

interface RepoBrowseLayoutProps {
    owner: string;
    repo: string;
    provider: Provider;
    selectedRef: string;
    onSelectRef: (ref: string) => void;
    path: string;
    children: ReactNode;
}

/**
 * GitHub's file browser shell for repo path pages: the file tree rail with the
 * branch picker and file search, and the listing or file body in the main
 * column.
 */
export function RepoBrowseLayout({
    owner,
    repo,
    provider,
    selectedRef,
    onSelectRef,
    path,
    children,
}: RepoBrowseLayoutProps) {
    const { setLeftOpen, setRightOpen } = useSidebar();

    // The repo About column renders inside the main column, so the layout's
    // right rail stays closed while a path page is mounted.
    useEffect(() => {
        setLeftOpen(true);
        setRightOpen(false);
        return () => setRightOpen(true);
    }, [setLeftOpen, setRightOpen]);

    return (
        <ResizableLayout
            boxed={false}
            pinnedLeft
            leftSidebar={
                <div className="flex h-full flex-col">
                    <div className="flex flex-col gap-2 border-border border-b px-3 py-3">
                        <h2 className="font-semibold text-sm text-text-primary">
                            Files
                        </h2>
                        <RefSelector
                            owner={owner}
                            repo={repo}
                            provider={provider}
                            selectedRef={selectedRef}
                            onSelect={onSelectRef}
                            variant="rail"
                        />
                        <RepoFileSearch
                            owner={owner}
                            repo={repo}
                            provider={provider}
                            selectedRef={selectedRef}
                        />
                    </div>
                    <div className="min-h-0 flex-1">
                        <RepoFileTree
                            owner={owner}
                            repo={repo}
                            provider={provider}
                            selectedRef={selectedRef}
                            path={path}
                        />
                    </div>
                </div>
            }
            rightSidebar={null}
        >
            {children}
        </ResizableLayout>
    );
}
