"use client";

import { pickDocFileNames } from "~/lib/doc-files";
import type { Provider } from "~/utils/provider-url";
import { RepoDocFiles } from "./repo-doc-files";
import { RepoPathBrowse } from "./repo-path-browse";

interface RepoDirectoryPageProps {
    owner: string;
    repo: string;
    provider: Provider;
    /** Branch or tag taken from the URL. */
    selectedRef: string;
    /** Repo-relative directory path; never "" on this page. */
    path: string;
}

/**
 * Directory page: the browser rail's main column for a directory, the
 * breadcrumb, commit bar and listing. The rail itself is the (browse) layout's.
 */
export function RepoDirectoryPage({
    owner,
    repo,
    provider,
    selectedRef,
    path,
}: RepoDirectoryPageProps) {
    return (
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
    );
}
