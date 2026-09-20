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
    rawContentReference,
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
    let previousHref: string | undefined;
    if (previous) {
        const previousReference = {
            kind: "commit" as const,
            value: previous.sha,
        };
        if (view === "tree") {
            previousHref = treeHref(
                provider,
                owner,
                repo,
                previousReference,
                path,
            );
        } else if (view === "blame") {
            previousHref = blameHref(
                provider,
                owner,
                repo,
                previousReference,
                path,
            );
        } else {
            previousHref = blobHref(
                provider,
                owner,
                repo,
                previousReference,
                path,
            );
        }
    }

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
                    rawContentReference(reference, resolvedObjectId),
                    path,
                )}
                previousHref={previousHref}
                trailing={trailing}
            />
        </div>
    );
}
