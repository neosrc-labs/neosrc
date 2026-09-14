"use client";

import { useRouter } from "next/navigation";
import { blobHref, type Provider } from "~/utils/provider-url";
import { RepoBreadcrumb } from "./repo-breadcrumb";
import { RepoBrowseLayout } from "./repo-browse-layout";
import { RepoContentCard } from "./repo-content-card";
import { RepoFileView, RepoFileViewSkeleton } from "./repo-file-view";
import { RepoPageBody } from "./repo-page-body";
import type { RepoPageData } from "./repo-page-types";

interface RepoBlobPageProps extends RepoPageData {
    owner: string;
    repo: string;
    provider: Provider;
    /** Branch or tag taken from the URL. */
    selectedRef: string;
    /** Repo-relative file path. */
    path: string;
}

export function RepoBlobPage({
    owner,
    repo,
    provider,
    selectedRef,
    path,
    ...data
}: RepoBlobPageProps) {
    const router = useRouter();

    return (
        <RepoBrowseLayout
            owner={owner}
            repo={repo}
            provider={provider}
            selectedRef={selectedRef}
            onSelectRef={(next) =>
                router.push(blobHref(provider, owner, repo, next, path))
            }
            path={path}
        >
            <RepoPageBody
                {...data}
                owner={owner}
                repo={repo}
                provider={provider}
                embedded
                contentFallback={<RepoFileViewSkeleton />}
            >
                {() => (
                    <>
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
                    </>
                )}
            </RepoPageBody>
        </RepoBrowseLayout>
    );
}
