"use client";

import { LockIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import {
    RECENT_ITEM_LIMIT,
    type ViewerItemProvider,
} from "~/server/api/routers/dashboard/types";
import { api } from "~/trpc/react";
import {
    ProviderFilter,
    type ProviderFilterValue,
} from "./_components/provider-filter";
import { RecentItemsSection } from "./_components/recent-items-section";

export function HomePage({
    providers,
}: {
    /** Providers the recent lists load from; drives the filter. */
    providers: ViewerItemProvider[];
}) {
    const { data: repos, isLoading } = api.repos.getTopRepos.useQuery();
    const [provider, setProvider] = useState<ProviderFilterValue>("all");

    // Both lists share one filter, so a provider switch refetches them together.
    const listInput = { provider, limit: RECENT_ITEM_LIMIT };
    const pulls = api.dashboard.recentPulls.useQuery(listInput);
    const issues = api.dashboard.recentIssues.useQuery(listInput);

    // Nothing to query: say why the lists are empty instead of showing two
    // empty cards.
    const emptyLabel = (fallback: string) =>
        providers.length > 0 ? (
            fallback
        ) : (
            <>
                Connect a{" "}
                <Link className="underline" href="/profile">
                    GitHub or Codeberg account
                </Link>{" "}
                to see your recent activity.
            </>
        );

    return (
        <main className="mx-auto flex min-h-[calc(100svh-var(--header-height))] w-full max-w-[1200px] gap-8 px-6 py-8">
            <h1 className="sr-only">Home</h1>
            <aside className="w-[20%] shrink-0">
                <h2 className="mb-4 font-semibold text-sm text-text-tertiary uppercase tracking-wider">
                    Top repositories
                </h2>
                {isLoading ? (
                    <div className="space-y-2">
                        {["s1", "s2", "s3", "s4", "s5"].map((key) => (
                            <div
                                key={key}
                                className="h-10 animate-pulse rounded-md bg-surface-secondary"
                            />
                        ))}
                    </div>
                ) : (
                    <ul className="space-y-0.5">
                        {repos?.map((repo) => (
                            <li key={repo.nameWithOwner}>
                                <Link
                                    href={`/${repo.nameWithOwner}`}
                                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-primary transition hover:bg-surface-secondary"
                                >
                                    <Image
                                        src={repo.owner.avatarUrl}
                                        alt=""
                                        className="h-5 w-5 shrink-0 rounded-full"
                                        width={20}
                                        height={20}
                                    />
                                    <span className="truncate">
                                        {repo.nameWithOwner}
                                    </span>
                                    {repo.isPrivate && (
                                        <LockIcon className="h-3 w-3 shrink-0 text-text-tertiary" />
                                    )}
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </aside>

            <div className="flex min-w-0 flex-1 flex-col gap-6">
                {providers.length > 1 && (
                    <div className="flex items-center justify-end gap-2">
                        <span className="text-sm text-text-tertiary">
                            Source
                        </span>
                        <ProviderFilter
                            value={provider}
                            onChange={setProvider}
                            providers={providers}
                        />
                    </div>
                )}

                <RecentItemsSection
                    title="Recent pull requests"
                    kind="pull"
                    emptyLabel={emptyLabel("No recent pull requests.")}
                    items={pulls.data?.items ?? []}
                    isLoading={pulls.isLoading}
                    unavailable={pulls.data?.unavailable ?? []}
                />

                <RecentItemsSection
                    title="Recent issues"
                    kind="issue"
                    emptyLabel={emptyLabel("No recent issues.")}
                    items={issues.data?.items ?? []}
                    isLoading={issues.isLoading}
                    unavailable={issues.data?.unavailable ?? []}
                />
            </div>
        </main>
    );
}
