"use client";

import type { ReactNode } from "react";
import { api } from "~/trpc/react";
import {
    blobHref,
    historyUrl,
    type Provider,
    treeHref,
} from "~/utils/provider-url";
import { RepoCommitRow } from "./repo-commit-row";

interface RepoPathCommitRowProps {
    owner: string;
    repo: string;
    provider: Provider;
    selectedRef: string;
    /** File or directory the row describes. */
    path: string;
    /** Route the previous-commit button opens for the same path. */
    view: "blob" | "tree";
    /** After the date, e.g. a file size. */
    trailing?: ReactNode;
}

/**
 * Commit bar of a file or directory page: the newest commit that touched
 * `path`, the commit before it for that path, and the path's history.
 */
export function RepoPathCommitRow({
    owner,
    repo,
    provider,
    selectedRef,
    path,
    view,
    trailing,
}: RepoPathCommitRowProps) {
    const { data: commits } = api.repos.getPathCommits.useQuery({
        provider,
        owner,
        repo,
        ref: selectedRef,
        path,
        limit: 2,
    });

    const latest = commits?.[0] ?? null;
    const previous = commits?.[1] ?? null;
    const previousHref = previous
        ? view === "blob"
            ? blobHref(provider, owner, repo, previous.sha, path)
            : treeHref(provider, owner, repo, previous.sha, path)
        : undefined;

    return (
        <RepoCommitRow
            owner={owner}
            repo={repo}
            provider={provider}
            commit={latest}
            author={latest?.author ?? null}
            historyHref={historyUrl(provider, owner, repo, selectedRef, path)}
            previousHref={previousHref}
            trailing={trailing}
        />
    );
}
