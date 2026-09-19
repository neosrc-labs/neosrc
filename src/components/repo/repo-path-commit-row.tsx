"use client";

import { type ReactNode, useEffect } from "react";
import { api } from "~/trpc/react";
import { cn } from "~/utils/helpers";
import {
    blameHref,
    blobHref,
    historyUrl,
    type Provider,
    type RepositoryReference,
    treeHref,
} from "~/utils/provider-url";
import { RepoCommitRow } from "./repo-commit-row";
import { pathCommitsPrevious } from "./repo-previous-data";

interface RepoPathCommitRowProps {
    owner: string;
    repo: string;
    provider: Provider;
    reference: RepositoryReference;
    resolvedObjectId: string | null;
    /** File or directory the row describes. */
    path: string;
    /** Route the previous-commit button opens for the same path. */
    view: "blob" | "tree" | "blame";
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
    reference,
    resolvedObjectId,
    path,
    view,
    trailing,
}: RepoPathCommitRowProps) {
    const queryKey = `${provider}/${owner}/${repo}/${reference.kind ?? "native"}/${reference.value}/${path}`;

    const { data: commits, isPlaceholderData } =
        api.repos.getPathCommits.useQuery(
            {
                provider,
                owner,
                repo,
                ref: resolvedObjectId ?? reference.value,
                path,
                limit: 2,
            },
            {
                enabled: resolvedObjectId !== null,
                placeholderData: () => pathCommitsPrevious.previous(queryKey),
            },
        );

    useEffect(() => {
        if (!isPlaceholderData && commits !== undefined) {
            pathCommitsPrevious.remember(queryKey, commits);
        }
    }, [isPlaceholderData, commits, queryKey]);

    const latest = commits?.[0] ?? null;
    const previous = commits?.[1] ?? null;
    const previousHref = previous
        ? view === "tree"
            ? treeHref(
                  provider,
                  owner,
                  repo,
                  { kind: "commit", value: previous.sha },
                  path,
              )
            : view === "blame"
              ? blameHref(
                    provider,
                    owner,
                    repo,
                    { kind: "commit", value: previous.sha },
                    path,
                )
              : blobHref(
                    provider,
                    owner,
                    repo,
                    { kind: "commit", value: previous.sha },
                    path,
                )
        : undefined;

    return (
        <div
            className={cn(
                isPlaceholderData && "pointer-events-none opacity-60",
            )}
        >
            <RepoCommitRow
                owner={owner}
                repo={repo}
                provider={provider}
                commit={latest}
                author={latest?.author ?? null}
                historyHref={historyUrl(
                    provider,
                    owner,
                    repo,
                    reference.value,
                    path,
                )}
                previousHref={previousHref}
                trailing={trailing}
            />
        </div>
    );
}
