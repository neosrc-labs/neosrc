"use client";

import type { Provider, RepositoryReference } from "~/utils/provider-url";
import { RepoBreadcrumb } from "./repo-breadcrumb";
import { RepoContentCard } from "./repo-content-card";
import { RepoFileView } from "./repo-file-view";

interface RepoBlobPageProps {
    owner: string;
    repo: string;
    provider: Provider;
    /** Branch or tag taken from the URL. */
    reference: RepositoryReference;
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
    reference,
    path,
}: RepoBlobPageProps) {
    return (
        <>
            <RepoBreadcrumb
                owner={owner}
                repo={repo}
                reference={reference}
                provider={provider}
                path={path}
            />
            <RepoContentCard>
                <RepoFileView
                    owner={owner}
                    repo={repo}
                    provider={provider}
                    reference={reference}
                    path={path}
                />
            </RepoContentCard>
        </>
    );
}
