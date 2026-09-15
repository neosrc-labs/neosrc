"use client";

import type { Provider } from "~/utils/provider-url";
import { RepoBreadcrumb } from "./repo-breadcrumb";
import { RepoContentCard } from "./repo-content-card";
import { RepoFileView } from "./repo-file-view";

interface RepoBlobPageProps {
    owner: string;
    repo: string;
    provider: Provider;
    /** Branch or tag taken from the URL. */
    selectedRef: string;
    /** Repo-relative file path. */
    path: string;
}

/**
 * File page: the browser rail's main column for a file, the breadcrumb, commit
 * bar and body. The rail itself is the (browse) layout's.
 */
export function RepoBlobPage({
    owner,
    repo,
    provider,
    selectedRef,
    path,
}: RepoBlobPageProps) {
    return (
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
    );
}
