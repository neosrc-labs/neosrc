"use client";

import { pickDocFileNames } from "~/lib/doc-files";
import type { Provider } from "~/utils/provider-url";
import { RepoDocFiles } from "./repo-doc-files";
import type { RepoPathPageData } from "./repo-page-types";
import { RepoPathBrowse, RepoPathBrowseSkeleton } from "./repo-path-browse";
import { RepoPathPage } from "./repo-path-page";

interface RepoDirectoryPageProps extends RepoPathPageData {
    owner: string;
    repo: string;
    provider: Provider;
    /** Branch or tag taken from the URL. */
    selectedRef: string;
    /** Repo-relative directory path; never "" on this page. */
    path: string;
}

/**
 * Directory page: the file browser rail beside the directory's breadcrumb,
 * commit bar and listing.
 */
export function RepoDirectoryPage({
    owner,
    repo,
    provider,
    selectedRef,
    path,
    repoDataPromise,
}: RepoDirectoryPageProps) {
    return (
        <RepoPathPage
            owner={owner}
            repo={repo}
            provider={provider}
            selectedRef={selectedRef}
            path={path}
            view="tree"
            repoDataPromise={repoDataPromise}
            contentFallback={<RepoPathBrowseSkeleton />}
        >
            <RepoPathBrowse
                owner={owner}
                repo={repo}
                provider={provider}
                selectedRef={selectedRef}
                path={path}
            >
                {(contents) => (
                    <RepoDocFiles
                        owner={owner}
                        repo={repo}
                        provider={provider}
                        ref={selectedRef}
                        fileNames={pickDocFileNames(contents)}
                        hideEmpty
                    />
                )}
            </RepoPathBrowse>
        </RepoPathPage>
    );
}
