"use client";

import type { Provider } from "~/utils/provider-url";
import { RepoBreadcrumb } from "./repo-breadcrumb";
import { RepoContentCard } from "./repo-content-card";
import { RepoFileView, RepoFileViewSkeleton } from "./repo-file-view";
import type { RepoPathPageData } from "./repo-page-types";
import { RepoPathPage } from "./repo-path-page";

interface RepoBlobPageProps extends RepoPathPageData {
    owner: string;
    repo: string;
    provider: Provider;
    /** Branch or tag taken from the URL. */
    selectedRef: string;
    /** Repo-relative file path. */
    path: string;
}

/**
 * File page: the file browser rail beside the file's breadcrumb, commit bar
 * and body.
 */
export function RepoBlobPage({
    owner,
    repo,
    provider,
    selectedRef,
    path,
    repoDataPromise,
}: RepoBlobPageProps) {
    return (
        <RepoPathPage
            owner={owner}
            repo={repo}
            provider={provider}
            selectedRef={selectedRef}
            path={path}
            view="blob"
            repoDataPromise={repoDataPromise}
            contentFallback={<RepoFileViewSkeleton />}
        >
            <RepoBreadcrumb
                owner={owner}
                repo={repo}
                selectedRef={selectedRef}
                provider={provider}
                path={path}
            />
            <RepoContentCard>
                <RepoFileView
                    owner={owner}
                    repo={repo}
                    provider={provider}
                    selectedRef={selectedRef}
                    path={path}
                />
            </RepoContentCard>
        </RepoPathPage>
    );
}
