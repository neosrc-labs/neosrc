"use client";

import { pickDocFileNames } from "~/utils/doc-files";
import {
    type Provider,
    type RepositoryReference,
    rawContentReference,
} from "~/utils/provider-url";
import { RepoDocFiles } from "./repo-doc-files";
import { RepoPathBrowse } from "./repo-path-browse";

interface RepoDirectoryPageProps {
    owner: string;
    repo: string;
    provider: Provider;
    /** Branch or tag taken from the URL. */
    reference: RepositoryReference;
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
    reference,
    path,
}: RepoDirectoryPageProps) {
    return (
        <RepoPathBrowse
            owner={owner}
            repo={repo}
            provider={provider}
            reference={reference}
            path={path}
        >
            {(contents, resolvedObjectId) => (
                <RepoDocFiles
                    owner={owner}
                    repo={repo}
                    provider={provider}
                    contentRef={resolvedObjectId ?? reference.value}
                    rawReference={rawContentReference(
                        reference,
                        resolvedObjectId,
                    )}
                    fileNames={pickDocFileNames(contents)}
                    hideEmpty
                />
            )}
        </RepoPathBrowse>
    );
}
