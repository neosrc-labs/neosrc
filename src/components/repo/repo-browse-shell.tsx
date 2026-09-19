"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { ResizableLayout } from "~/components/layout/resizable-layout";
import { useSidebar } from "~/components/layout/sidebar-context";
import {
    blameHref,
    blobHref,
    type Provider,
    treeHref,
} from "~/utils/provider-url";
import { parseRepoBrowsePath } from "~/utils/route";
import { RefSelector } from "./ref-selector";
import { RepoFileSearch } from "./repo-file-search";
import { RepoFileTree } from "./repo-file-tree";

interface RepoBrowseShellProps {
    provider: Provider;
    owner: string;
    repo: string;
    children: ReactNode;
}

/**
 * Persistent shell of the file and directory pages: the file tree rail with the
 * branch picker and file search. It lives in the (browse) layout, so client-side
 * navigation between browse pages keeps the rail's DOM, expansion and scroll.
 */
export function RepoBrowseShell({
    provider,
    owner,
    repo,
    children,
}: RepoBrowseShellProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { setLeftOpen, setRightOpen } = useSidebar();

    const location = parseRepoBrowsePath(
        pathname,
        `/${provider}/${owner}/${repo}`,
        searchParams.get("refKind"),
    );
    // The branch root renders its own main column with the repo name header and
    // the About column, so the shell stays out of its way.
    const hasPath = location !== null && location.path !== "";

    useEffect(() => {
        if (!hasPath) return;
        setLeftOpen(true);
        setRightOpen(false);
        return () => setRightOpen(true);
    }, [hasPath, setLeftOpen, setRightOpen]);

    if (!location || location.path === "") return <>{children}</>;

    const { view, reference, path } = location;

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
                            reference={reference}
                            onSelect={(next) =>
                                router.push(
                                    view === "tree"
                                        ? treeHref(
                                              provider,
                                              owner,
                                              repo,
                                              next,
                                              path,
                                          )
                                        : view === "blame"
                                          ? blameHref(
                                                provider,
                                                owner,
                                                repo,
                                                next,
                                                path,
                                            )
                                          : blobHref(
                                                provider,
                                                owner,
                                                repo,
                                                next,
                                                path,
                                            ),
                                )
                            }
                            variant="rail"
                        />
                        <RepoFileSearch
                            owner={owner}
                            repo={repo}
                            provider={provider}
                            reference={reference}
                        />
                    </div>
                    <div className="min-h-0 flex-1">
                        <RepoFileTree
                            owner={owner}
                            repo={repo}
                            provider={provider}
                            reference={reference}
                            path={path}
                        />
                    </div>
                </div>
            }
            rightSidebar={null}
        >
            <div className="mx-auto min-h-[calc(100svh-var(--header-height))] max-w-7xl px-6 py-6">
                {children}
            </div>
        </ResizableLayout>
    );
}
