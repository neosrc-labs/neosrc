"use client";

import { GitBranch, GitPullRequestArrow } from "lucide-react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/utils";

/**
 * Mirrors GitHub's "recent pushes" banner: the branch the signed-in user
 * pushed to within the last hour that has no pull request yet. The query is
 * deliberately separate from the list query so the banner never delays the
 * pull request list.
 */
export function RecentlyPushedBanner({
    owner,
    repo,
    provider,
}: {
    owner: string;
    repo: string;
    provider: "gh" | "cb";
}) {
    const { data } = api.pulls.recentlyPushedBranch.useQuery(
        { owner, repo, provider },
        {
            // The window is an hour, so a minute of staleness is harmless and
            // keeps tab switches from re-querying the provider.
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: false,
        },
    );

    if (!data) return null;

    const branchHref = `/${provider}/${owner}/${repo}/commits/${encodeURIComponent(data.branch)}`;

    return (
        <div className="mb-3 flex h-12 items-center justify-between gap-3 rounded-lg border border-yellow-800/50 bg-yellow-50 px-4 text-yellow-800 dark:border-yellow-700/50 dark:bg-yellow-950 dark:text-yellow-200">
            <div className="flex min-w-0 items-center gap-2 text-sm">
                <GitBranch className="size-4 shrink-0" />
                <span className="min-w-0 truncate">
                    <Link
                        href={branchHref}
                        className="font-medium hover:underline"
                    >
                        {data.branch}
                    </Link>
                    <span className="opacity-80">
                        {" "}
                        had recent pushes {formatRelativeTime(data.pushedAt)}
                    </span>
                </span>
            </div>
            {/* Same affordance and size as the list's New Pull Request action. */}
            <a
                href={data.compareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-green-600 bg-green-600 px-2.5 py-1.5 font-medium text-sm text-white transition-colors hover:bg-green-700 dark:border-green-500 dark:bg-green-600 dark:hover:bg-green-700"
            >
                <GitPullRequestArrow className="size-4" />
                Compare &amp; pull request
            </a>
        </div>
    );
}
