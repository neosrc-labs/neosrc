"use client";

import { ChevronLeftIcon, HistoryIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { UserLink } from "~/components/user/user-link";
import { formatRelativeTime } from "~/utils/format-time";
import { domain, type Provider } from "~/utils/provider-url";

interface RepoCommitRowProps {
    owner: string;
    repo: string;
    provider: Provider;
    /** Commit the row describes; null renders its loading state. */
    commit: {
        sha: string;
        message: string;
        committedDate: string | null;
    } | null;
    author?: { login: string | null; avatarUrl: string | null } | null;
    /** Between the message and the sha, e.g. the status check card. */
    status?: ReactNode;
    /** After the date, e.g. the commit count or a file size. */
    trailing?: ReactNode;
    /** Commits page (or file history) the row links to. */
    historyHref: string;
    historyLabel?: string;
    /** Previous commit for the row's path; omits the button when unset. */
    previousHref?: string;
}

/**
 * Latest-commit row above a directory listing or a file body, shared by both
 * so the two views stay in step.
 */
export function RepoCommitRow({
    owner,
    repo,
    provider,
    commit,
    author,
    status,
    trailing,
    historyHref,
    historyLabel,
    previousHref,
}: RepoCommitRowProps) {
    if (!commit) return <RepoCommitRowSkeleton />;

    const commitUrl = `https://${domain(provider)}/${owner}/${repo}/commit/${commit.sha}`;

    return (
        <div className="flex min-h-12 items-center gap-3 border-border border-b px-4 py-3">
            {author && (
                <div className="[&_img]:h-5 [&_img]:w-5 [&_span]:text-sm">
                    <UserLink
                        provider={provider}
                        actor={
                            author.login
                                ? {
                                      login: author.login,
                                      avatarUrl: author.avatarUrl ?? "",
                                      url: `https://${domain(provider)}/${author.login}`,
                                  }
                                : null
                        }
                    />
                </div>
            )}
            <a
                href={commitUrl}
                className="min-w-0 flex-1 truncate text-sm text-text-tertiary hover:text-blue-600 dark:hover:text-blue-400"
            >
                {commit.message}
            </a>
            {status}
            <a
                href={commitUrl}
                className="ml-auto shrink-0 pt-px font-mono text-text-tertiary text-xs hover:text-blue-600 dark:hover:text-blue-400"
            >
                {commit.sha.slice(0, 7)}
            </a>
            {commit.committedDate && (
                <span
                    className="shrink-0 text-text-tertiary text-xs"
                    title={new Date(commit.committedDate).toLocaleString()}
                >
                    {formatRelativeTime(commit.committedDate)}
                </span>
            )}
            {trailing}
            {previousHref && (
                <Link
                    href={previousHref}
                    aria-label="Previous commit for this path"
                    title="Previous commit"
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-border text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
                >
                    <ChevronLeftIcon className="h-3.5 w-3.5" />
                </Link>
            )}
            <Link
                href={historyHref}
                className="inline-flex shrink-0 items-center gap-1 text-sm text-text-primary hover:text-blue-600 dark:hover:text-blue-400"
            >
                <HistoryIcon className="h-3.5 w-3.5" />
                {historyLabel ?? "History"}
            </Link>
        </div>
    );
}

/** Loading state of the shared commit row. */
export function RepoCommitRowSkeleton() {
    return (
        <div className="flex min-h-12 items-center gap-3 border-border border-b px-4 py-3">
            <div className="h-5 w-24 animate-pulse rounded bg-surface-secondary" />
            <div className="h-5 w-64 animate-pulse rounded bg-surface-secondary" />
        </div>
    );
}
