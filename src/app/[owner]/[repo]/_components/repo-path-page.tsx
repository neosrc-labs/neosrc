"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { blobHref, type Provider, treeHref } from "~/utils/provider-url";
import { RepoBrowseLayout } from "./repo-browse-layout";
import type { RepoPathPageData } from "./repo-page-types";
import { RepoPathPageBody } from "./repo-path-page-body";

interface RepoPathPageProps extends RepoPathPageData {
    owner: string;
    repo: string;
    provider: Provider;
    selectedRef: string;
    /** Repo-relative file or directory path. */
    path: string;
    /** View the rail's branch picker keeps you on. */
    view: "blob" | "tree";
    /** Shown while the repo query resolves. */
    contentFallback: ReactNode;
    children: ReactNode;
}

/**
 * A file or directory page: the file tree rail with the branch picker and file
 * search, and the page's own column beside it.
 */
export function RepoPathPage({
    owner,
    repo,
    provider,
    selectedRef,
    path,
    view,
    repoDataPromise,
    contentFallback,
    children,
}: RepoPathPageProps) {
    const router = useRouter();

    return (
        <RepoBrowseLayout
            owner={owner}
            repo={repo}
            provider={provider}
            selectedRef={selectedRef}
            path={path}
            onSelectRef={(next) =>
                router.push(
                    view === "tree"
                        ? treeHref(provider, owner, repo, next, path)
                        : blobHref(provider, owner, repo, next, path),
                )
            }
        >
            <RepoPathPageBody
                repoDataPromise={repoDataPromise}
                contentFallback={contentFallback}
            >
                {children}
            </RepoPathPageBody>
        </RepoBrowseLayout>
    );
}
