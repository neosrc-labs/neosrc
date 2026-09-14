"use client";

import { Async } from "~/components/async";
import type { Provider } from "~/utils/provider-url";
import { RecentlyPushedBanner } from "./recently-pushed-banner";
import { RepoDocFiles, RepoDocFilesSkeleton } from "./repo-doc-files";
import { RepoFileTable, RepoFileTableSkeleton } from "./repo-file-table";
import { RepoPageBody } from "./repo-page-body";
import type { RepoPageData } from "./repo-page-types";

interface RepoCodePageProps extends RepoPageData {
    owner: string;
    repo: string;
    provider: Provider;
}

export function RepoCodePage({
    owner,
    repo,
    provider,
    ...data
}: RepoCodePageProps) {
    return (
        <RepoPageBody
            {...data}
            owner={owner}
            repo={repo}
            provider={provider}
            contentFallback={
                <RepoFileTableSkeleton owner={owner} repo={repo} />
            }
        >
            {(repoData) => (
                <>
                    <RecentlyPushedBanner
                        owner={owner}
                        repo={repo}
                        provider={provider}
                    />

                    <RepoFileTable
                        key={`${owner}/${repo}`}
                        owner={owner}
                        repo={repo}
                        provider={provider}
                        defaultBranch={repoData.defaultBranch}
                        isFork={repoData.isFork}
                        parentFullName={repoData.parentFullName}
                        parentDefaultBranch={repoData.parentDefaultBranch}
                    />

                    <Async
                        promise={Promise.all([
                            data.repoDataPromise,
                            data.docFileNamesPromise,
                        ])}
                        fallback={<RepoDocFilesSkeleton />}
                    >
                        {([repoDataForDocs, docFileNames]) => (
                            <RepoDocFiles
                                owner={owner}
                                repo={repo}
                                ref={repoDataForDocs.defaultBranch}
                                fileNames={docFileNames}
                                provider={provider}
                            />
                        )}
                    </Async>
                </>
            )}
        </RepoPageBody>
    );
}
