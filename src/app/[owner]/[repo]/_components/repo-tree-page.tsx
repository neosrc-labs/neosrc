"use client";

import { useRouter } from "next/navigation";
import { pickDocFileNames } from "~/lib/doc-files";
import { type Provider, treeHref } from "~/utils/provider-url";
import { RepoBrowse, RepoBrowseSkeleton } from "./repo-browse";
import { RepoBrowseLayout } from "./repo-browse-layout";
import { RepoDocFiles } from "./repo-doc-files";
import { RepoPageBody } from "./repo-page-body";
import type { RepoPageData } from "./repo-page-types";
import { RepoPathBrowse, RepoPathBrowseSkeleton } from "./repo-path-browse";

interface RepoTreePageProps extends RepoPageData {
    owner: string;
    repo: string;
    provider: Provider;
    /** Branch or tag taken from the URL. */
    selectedRef: string;
    /** Repo-relative directory path; "" for the repo root. */
    path: string;
}

export function RepoTreePage({
    owner,
    repo,
    provider,
    selectedRef,
    path,
    ...data
}: RepoTreePageProps) {
    const router = useRouter();

    const docFiles = (contents: Parameters<typeof pickDocFileNames>[0]) => (
        <RepoDocFiles
            owner={owner}
            repo={repo}
            provider={provider}
            ref={selectedRef}
            fileNames={pickDocFileNames(contents)}
            hideEmpty
        />
    );

    // The repo root has no file tree, as on GitHub; a path inside the branch
    // gets the tree rail and the path-shaped main column.
    if (path !== "") {
        return (
            <RepoBrowseLayout
                owner={owner}
                repo={repo}
                provider={provider}
                selectedRef={selectedRef}
                onSelectRef={(next) =>
                    router.push(treeHref(provider, owner, repo, next, path))
                }
                path={path}
            >
                <RepoPageBody
                    {...data}
                    owner={owner}
                    repo={repo}
                    provider={provider}
                    embedded
                    contentFallback={<RepoPathBrowseSkeleton />}
                >
                    {() => (
                        <RepoPathBrowse
                            owner={owner}
                            repo={repo}
                            provider={provider}
                            selectedRef={selectedRef}
                            path={path}
                        >
                            {docFiles}
                        </RepoPathBrowse>
                    )}
                </RepoPageBody>
            </RepoBrowseLayout>
        );
    }

    return (
        <RepoPageBody
            {...data}
            owner={owner}
            repo={repo}
            provider={provider}
            contentFallback={<RepoBrowseSkeleton owner={owner} repo={repo} />}
        >
            {() => (
                <RepoBrowse
                    owner={owner}
                    repo={repo}
                    provider={provider}
                    selectedRef={selectedRef}
                    path={path}
                    onSelectRef={(next) =>
                        router.push(treeHref(provider, owner, repo, next, path))
                    }
                >
                    {docFiles}
                </RepoBrowse>
            )}
        </RepoPageBody>
    );
}
