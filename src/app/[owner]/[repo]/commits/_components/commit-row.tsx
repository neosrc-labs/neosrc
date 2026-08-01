"use client";

import Link from "next/link";
import { StatusCheckIcon, StatusChecksHoverCard } from "~/components/ci-status";
import { CommitSubject } from "~/components/commit-subject";
import { UserLink } from "~/components/user-link";
import { cn } from "~/lib/utils";
import { formatRelativeTime } from "~/utils";
import type { CommitListItem } from "~/server/api/routers/commits/types";

interface CommitRowProps {
  commit: CommitListItem;
  owner: string;
  repo: string;
  provider: "gh" | "cb";
  showStatus: boolean;
}

export function CommitRow({
  commit,
  owner,
  repo,
  provider,
  showStatus,
}: CommitRowProps) {
  const commitUrl = `/${provider === "gh" ? "gh" : "cb"}/${owner}/${repo}/commit/${commit.sha}`;
  const relativeTime = formatRelativeTime(commit.committedDate);

  return (
    <div className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-surface-secondary">
      {/* Subject + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={commitUrl}
            className="truncate font-medium text-sm text-text-primary hover:text-blue-600 dark:hover:text-blue-400"
          >
            <CommitSubject message={commit.message} />
          </Link>
        </div>
      </div>

      {/* Author */}
      <div className="flex shrink-0 items-center gap-3 text-sm text-text-secondary">
        {commit.author ? (
          <UserLink
            actor={{ login: commit.author.login, avatarUrl: commit.author.avatarUrl }}
            provider={provider}
            showUsername={false}
          />
        ) : (
          commit.committerName && (
            <span className="truncate max-w-[120px]">{commit.committerName}</span>
          )
        )}
        <span className="w-16 text-right tabular-nums whitespace-nowrap">
          {relativeTime}
        </span>
      </div>

      {/* CI Status */}
      {showStatus && (
        <div className="flex shrink-0 items-center justify-end" style={{ width: 24 }}>
          {commit.statusState && (
            <StatusChecksHoverCard contexts={commit.statusContexts}>
              <StatusCheckIcon
                state={commit.statusState}
                className="size-4"
              />
            </StatusChecksHoverCard>
          )}
        </div>
      )}

      {/* SHA */}
      <Link
        href={commitUrl}
        className="shrink-0 font-mono text-xs text-text-muted hover:text-text-primary transition-colors"
      >
        {commit.shortSha}
      </Link>
    </div>
  );
}
