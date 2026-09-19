"use client";

import type { Provider, RepositoryReference } from "~/utils/provider-url";
import { RepoBlameView } from "./repo-blame-view";
import { RepoBreadcrumb } from "./repo-breadcrumb";
import { RepoContentCard } from "./repo-content-card";

interface RepoBlamePageProps {
    owner: string;
    repo: string;
    provider: Provider;
    /** Branch or tag taken from the URL. */
    reference: RepositoryReference;
    /** Repo-relative file path. */
    path: string;
}

/**
 * Blame page: the browser rail's main column for a file's authorship, the
 * breadcrumb, commit bar and blame body.
 */
export function RepoBlamePage({
    owner,
    repo,
    provider,
    reference,
    path,
}: RepoBlamePageProps) {
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
                <RepoBlameView
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
