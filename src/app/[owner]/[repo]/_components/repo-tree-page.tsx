"use client";

import { useRouter } from "next/navigation";
import { pickDocFileNames } from "~/lib/doc-files";
import { type Provider, treeHref } from "~/utils/provider-url";
import { RepoBrowse, RepoBrowseSkeleton } from "./repo-browse";
import { RepoDocFiles } from "./repo-doc-files";
import { RepoPageBody } from "./repo-page-body";
import type { RepoPageData } from "./repo-page-types";

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
                </RepoBrowse>
            )}
        </RepoPageBody>
    );
}
