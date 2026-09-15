"use client";

import type { Provider } from "~/utils/provider-url";
import { RepoBlameView } from "./repo-blame-view";
import { RepoBreadcrumb } from "./repo-breadcrumb";
import { RepoContentCard } from "./repo-content-card";

interface RepoBlamePageProps {
    owner: string;
    repo: string;
    provider: Provider;
    /** Branch or tag taken from the URL. */
    selectedRef: string;
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
    selectedRef,
    path,
}: RepoBlamePageProps) {
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
                <RepoBlameView
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
