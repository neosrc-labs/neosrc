"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { UserLink } from "~/components/user/user-link";
import type { BlameAuthor, BlameCommit, BlameRange } from "~/server/github";
import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/utils/format-time";
import { cn, formatFileSize } from "~/utils/helpers";
import { blobHref, type Provider, rawUrl } from "~/utils/provider-url";
import { RepoBusyBar } from "./repo-busy-bar";
import { FileBodySkeleton, useHighlightedLines } from "./repo-code-view";
import { useRepoFileData } from "./repo-file-data";
import { RepoFileTabs } from "./repo-file-tabs";
import { RepoFileActions, RepoFileToolbar } from "./repo-file-toolbar";
import { RepoPathCommitRow } from "./repo-path-commit-row";
import { RepoPathNotFound } from "./repo-path-not-found";
import { blamePrevious } from "./repo-previous-data";

interface RepoBlameViewProps {
    owner: string;
    repo: string;
    provider: Provider;
    selectedRef: string;
    /** Repo-relative file path. */
    path: string;
}

/** Legend order: oldest to newest age bucket. */
const AGE_SCALE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Age scale index (0 = oldest) for a provider age (1 = newest .. 10 = oldest). */
function ageColorIndex(age: number): number {
    return Math.min(9, Math.max(0, 10 - age));
}

/**
 * File page with per-range authorship: the commit gutter, age bar and code,
 * mirroring GitHub's blame view.
 */
export function RepoBlameView({
    owner,
    repo,
    provider,
    selectedRef,
    path,
}: RepoBlameViewProps) {
    const file = useRepoFileData({ provider, owner, repo, selectedRef, path });
    const queryKey = `${provider}/${owner}/${repo}/${selectedRef}/${path}`;

    const blameQuery = api.repos.getBlame.useQuery(
        { provider, owner, repo, ref: selectedRef, path },
        { placeholderData: () => blamePrevious.previous(queryKey) },
    );

    useEffect(() => {
        if (!blameQuery.isPlaceholderData && blameQuery.data !== undefined) {
            blamePrevious.remember(queryKey, blameQuery.data);
        }
    }, [blameQuery.isPlaceholderData, blameQuery.data, queryKey]);

    const name = path.split("/").pop() ?? path;
    const highlightedLines = useHighlightedLines(name, file.content ?? "");

    if (file.pathMissing) {
        return (
            <RepoPathNotFound
                provider={provider}
                owner={owner}
                repo={repo}
                selectedRef={selectedRef}
            />
        );
    }

    const raw = rawUrl(provider, owner, repo, selectedRef, path);
    const blame = blameQuery.data;
    const busy = file.busy || blameQuery.isPlaceholderData;

    // Every range shares one line-number width: sizing it per range would shift
    // the code column wherever the digit count changes.
    const lastLineNumber =
        blame?.ranges.reduce((max, range) => Math.max(max, range.endLine), 0) ??
        0;
    const lineNumberWidth = `${String(lastLineNumber).length}ch`;

    return (
        <>
            <RepoBusyBar busy={busy} />
            <RepoPathCommitRow
                owner={owner}
                repo={repo}
                provider={provider}
                selectedRef={selectedRef}
                path={path}
                view="blame"
                trailing={
                    <span className="shrink-0 text-text-tertiary text-xs">
                        {file.entry ? formatFileSize(file.entry.size) : null}
                    </span>
                }
            />

            <div className={cn(busy && "pointer-events-none opacity-60")}>
                <RepoFileToolbar
                    tabs={
                        <RepoFileTabs
                            provider={provider}
                            owner={owner}
                            repo={repo}
                            selectedRef={selectedRef}
                            path={path}
                            active="blame"
                        />
                    }
                    meta={file.contentLabel}
                    actions={
                        <RepoFileActions
                            name={name}
                            content={file.content}
                            rawHref={raw}
                        />
                    }
                />

                <div className="flex min-h-8 items-center gap-2 border-border border-b px-4 py-1 text-xs">
                    <span className="text-text-tertiary">Older</span>
                    <div className="flex overflow-hidden rounded-sm">
                        {AGE_SCALE.map((index) => (
                            <div
                                key={index}
                                className="h-3 w-4"
                                style={{
                                    backgroundColor: `var(--color-blame-age-${index})`,
                                }}
                            />
                        ))}
                    </div>
                    <span className="text-text-tertiary">Newer</span>
                </div>

                {file.contentFailed ? (
                    <div className="px-6 py-12 text-center">
                        <p className="font-medium text-base text-text-primary">
                            Couldn&apos;t load this file.
                        </p>
                        <button
                            type="button"
                            onClick={file.retryContent}
                            className="mt-2 cursor-pointer text-blue-600 text-sm hover:underline dark:text-blue-400"
                        >
                            Try again
                        </button>
                    </div>
                ) : blame === undefined ? (
                    <FileBodySkeleton />
                ) : file.content === null ? (
                    <div className="px-6 py-12 text-center">
                        <p className="font-medium text-base text-text-primary">
                            This file is binary or too large to blame.
                        </p>
                        <a
                            href={raw}
                            className="mt-2 inline-block text-blue-600 text-sm hover:underline dark:text-blue-400"
                        >
                            View raw
                        </a>
                    </div>
                ) : blame === null ? (
                    <div className="px-6 py-12 text-center">
                        <p className="font-medium text-base text-text-primary">
                            Blame is not available for this file.
                        </p>
                        <Link
                            href={blobHref(
                                provider,
                                owner,
                                repo,
                                selectedRef,
                                path,
                            )}
                            className="mt-2 inline-block text-blue-600 text-sm hover:underline dark:text-blue-400"
                        >
                            View the file
                        </Link>
                    </div>
                ) : (
                    <div
                        className={cn(
                            "overflow-x-auto font-mono text-xs leading-5",
                            blameQuery.isPlaceholderData &&
                                "pointer-events-none opacity-60",
                        )}
                    >
                        {/* Sized to the widest line, so each range's separator
                            spans the scroll width instead of stopping at the
                            scrollport edge. */}
                        <div className="w-max min-w-full">
                            {blame.ranges.map((range) => (
                                <BlameRangeRow
                                    key={range.startLine}
                                    owner={owner}
                                    repo={repo}
                                    range={range}
                                    commit={blame.commits[range.sha]}
                                    sourceLines={
                                        file.content?.split("\n") ?? []
                                    }
                                    highlightedLines={highlightedLines}
                                    lineNumberWidth={lineNumberWidth}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

function BlameRangeRow({
    owner,
    repo,
    range,
    commit,
    sourceLines,
    highlightedLines,
    lineNumberWidth,
}: {
    owner: string;
    repo: string;
    range: BlameRange;
    commit: BlameCommit | undefined;
    sourceLines: string[];
    highlightedLines: string[] | null;
    /** Shared width of the line-number column, sized to the file's digits. */
    lineNumberWidth: string;
}) {
    const lineNumbers: number[] = [];
    for (let line = range.startLine; line <= range.endLine; line++) {
        lineNumbers.push(line);
    }

    return (
        <div className="flex border-border border-t">
            <div className="sticky left-0 z-10 flex shrink-0 bg-surface">
                <div
                    className="w-1 shrink-0"
                    style={{
                        backgroundColor: `var(--color-blame-age-${ageColorIndex(range.age)})`,
                    }}
                />
                <div className="flex w-[300px] items-center gap-2 px-2 py-0.5">
                    {commit ? (
                        <>
                            <span className="w-[100px] shrink-0 whitespace-nowrap text-text-tertiary">
                                {commit.committedDate
                                    ? formatRelativeTime(commit.committedDate)
                                    : ""}
                            </span>
                            <BlameAuthorAvatar author={commit.author} />
                            <a
                                href={`https://github.com/${owner}/${repo}/commit/${range.sha}`}
                                className="min-w-0 flex-1 truncate text-text-secondary hover:text-blue-600 dark:hover:text-blue-400"
                            >
                                {commit.message}
                            </a>
                        </>
                    ) : null}
                </div>
            </div>
            <div className="flex min-w-0 flex-1">
                <div
                    aria-hidden
                    // + 1.5rem is the px-3 gutter, + 1px the right border:
                    // border-box would otherwise squeeze the digits.
                    className="shrink-0 select-none border-border border-r bg-surface-elevated px-3 text-right text-text-muted"
                    style={{ width: `calc(${lineNumberWidth} + 1.5rem + 1px)` }}
                >
                    {lineNumbers.map((line) => (
                        <div key={line}>{line}</div>
                    ))}
                </div>
                <code className="min-w-0 flex-1 whitespace-pre px-3">
                    {lineNumbers.map((line) => {
                        const html = highlightedLines?.[line - 1];
                        if (html === undefined) {
                            return (
                                <div key={line}>
                                    {sourceLines[line - 1] ?? ""}
                                </div>
                            );
                        }
                        return (
                            <div
                                key={line}
                                // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki escapes the source before emitting token markup
                                dangerouslySetInnerHTML={{ __html: html }}
                            />
                        );
                    })}
                </code>
            </div>
        </div>
    );
}

function BlameAuthorAvatar({ author }: { author: BlameAuthor | null }) {
    if (author?.login) {
        return (
            <div className="[&_img]:h-5 [&_img]:w-5">
                <UserLink
                    provider="gh"
                    showUsername={false}
                    actor={{
                        login: author.login,
                        avatarUrl: author.avatarUrl ?? "",
                        url: author.url ?? undefined,
                    }}
                />
            </div>
        );
    }
    if (author?.avatarUrl) {
        return (
            <Image
                src={author.avatarUrl}
                alt={author.name ?? ""}
                title={author.name ?? ""}
                width={20}
                height={20}
                className="h-5 w-5 shrink-0 rounded-full object-cover"
            />
        );
    }
    return null;
}
