"use client";

import { useRouter } from "next/navigation";
import { pickDocFileNames } from "~/utils/doc-files";
import {
    type Provider,
    type RepositoryReference,
    treeHref,
} from "~/utils/provider-url";
import { RepoBrowse, RepoBrowseSkeleton } from "./repo-browse";
import { RepoDocFiles } from "./repo-doc-files";
import { RepoPageBody } from "./repo-page-body";
import type { RepoPageData } from "./repo-page-types";

interface RepoTreePageProps extends RepoPageData {
    owner: string;
    repo: string;
    provider: Provider;
    /** Branch or tag taken from the URL. */
    reference: RepositoryReference;
}

/**
 * Branch root listing. The repo root view, so it keeps the repo name header
 * and the About column; a path inside the branch is a `RepoDirectoryPage`.
 */
export function RepoTreePage({
    owner,
    repo,
    provider,
    reference,
    ...data
}: RepoTreePageProps) {
    const router = useRouter();

    return (
        <RepoPageBody
            {...data}
            owner={owner}
            repo={repo}
            provider={provider}
            contentFallback={
                <RepoBrowseSkeleton
                    owner={owner}
                    repo={repo}
                    provider={provider}
                />
            }
        >
            {() => (
                <RepoBrowse
                    owner={owner}
                    repo={repo}
                    provider={provider}
                    reference={reference}
                    path=""
                    onSelectRef={(next) =>
                        router.push(treeHref(provider, owner, repo, next))
                    }
                >
                    {(contents, resolvedObjectId) => (
                        <RepoDocFiles
                            owner={owner}
                            repo={repo}
                            provider={provider}
                            ref={resolvedObjectId ?? reference.value}
                            fileNames={pickDocFileNames(contents)}
                            hideEmpty
                        />
                    )}
                </RepoBrowse>
            )}
        </RepoPageBody>
    );
}
