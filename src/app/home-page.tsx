"use client";

import { LockIcon } from "lucide-react";
import Link from "next/link";

import { api } from "~/trpc/react";

export function HomePage() {
    const { data: repos, isLoading } = api.repos.getTopRepos.useQuery();

    return (
        <main className="mx-auto flex min-h-[calc(100svh-var(--header-height))] max-w-[1200px] gap-8 px-6 py-8">
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
                                    <img
                                        src={repo.owner.avatarUrl}
                                        alt=""
                                        className="h-5 w-5 shrink-0 rounded-full"
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

            <div className="flex-1">
                <div className="rounded-xl border border-border p-8">
                    <h1 className="mb-2 text-2xl text-text-primary">
                        Welcome to Neosrc
                    </h1>
                    <p className="text-text-secondary">
                        Select a repository from the sidebar to get started, or
                        navigate directly to a pull request at{" "}
                        <code className="rounded bg-surface-secondary px-1.5 py-0.5 font-mono text-sm text-text-primary">
                            /&#123;owner&#125;/&#123;repo&#125;/pull/&#123;number&#125;
                        </code>
                        .
                    </p>
                </div>
            </div>
        </main>
    );
}
