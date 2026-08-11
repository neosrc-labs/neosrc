"use client";

import { RefreshCw, RotateCcw } from "lucide-react";
import { useState } from "react";

import type { SyncResult } from "~/server/db/sync";
import { api } from "~/trpc/react";

function formatResult(result: SyncResult): string {
    const parts = [
        `${result.accountsUpserted} account${
            result.accountsUpserted === 1 ? "" : "s"
        }`,
        `${result.reposUpserted} repo${result.reposUpserted === 1 ? "" : "s"}`,
    ];
    if (result.relationsWritten > 0 || result.relationsRemoved > 0) {
        parts.push(
            `${result.relationsWritten} grants added, ${result.relationsRemoved} removed`,
        );
    }
    if (result.teamsSkipped > 0) {
        parts.push(
            `${result.teamsSkipped} team${
                result.teamsSkipped === 1 ? "" : "s"
            } skipped`,
        );
    }
    return parts.join(", ");
}

export function SyncSection({
    hasGithub,
    hasCodeberg,
}: {
    hasGithub: boolean;
    hasCodeberg: boolean;
}) {
    const syncCurrentUser = api.sync.currentUser.useMutation();
    const refreshOwnerRepos = api.sync.refreshOwnerRepos.useMutation();
    const [provider, setProvider] = useState<"github" | "codeberg">("github");
    const [owner, setOwner] = useState("");

    if (!hasGithub && !hasCodeberg) {
        return (
            <p className="text-sm text-text-tertiary">
                Link a GitHub or Codeberg account to sync your permissions.
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <section className="rounded-lg border border-border-subtle p-6">
                <div className="flex flex-col gap-4">
                    <div>
                        <h3 className="font-medium text-sm text-text-label">
                            Sync my permissions
                        </h3>
                        <p className="mt-1 text-sm text-text-tertiary">
                            Refresh your account, organization memberships and
                            repository grants for every connected provider.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            disabled={syncCurrentUser.isPending}
                            onClick={() => syncCurrentUser.mutate()}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                        >
                            <RefreshCw
                                className={`h-4 w-4 ${
                                    syncCurrentUser.isPending
                                        ? "animate-spin"
                                        : ""
                                }`}
                            />
                            {syncCurrentUser.isPending
                                ? "Syncing..."
                                : "Sync permissions"}
                        </button>
                        {syncCurrentUser.error && (
                            <p className="text-red-600 text-xs dark:text-red-400">
                                {syncCurrentUser.error.message}
                            </p>
                        )}
                    </div>
                    {syncCurrentUser.data && (
                        <ul className="space-y-1 text-sm text-text-secondary">
                            {Object.entries(syncCurrentUser.data).map(
                                ([providerName, result]) => (
                                    <li key={providerName}>
                                        <strong className="font-medium text-text-label">
                                            {providerName === "github"
                                                ? "GitHub"
                                                : "Codeberg"}
                                            :
                                        </strong>{" "}
                                        {formatResult(result)}
                                    </li>
                                ),
                            )}
                        </ul>
                    )}
                </div>
            </section>

            <section className="rounded-lg border border-border-subtle p-6">
                <div className="flex flex-col gap-4">
                    <div>
                        <h3 className="font-medium text-sm text-text-label">
                            Refresh owner repositories
                        </h3>
                        <p className="mt-1 text-sm text-text-tertiary">
                            Re-sync the account and repository rows for a user
                            or organization.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <select
                            value={provider}
                            onChange={(e) => {
                                setProvider(
                                    e.target.value as "github" | "codeberg",
                                );
                                refreshOwnerRepos.reset();
                            }}
                            className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        >
                            <option value="github">GitHub</option>
                            <option value="codeberg">Codeberg</option>
                        </select>
                        <input
                            value={owner}
                            onChange={(e) => {
                                setOwner(e.target.value);
                                refreshOwnerRepos.reset();
                            }}
                            placeholder="Owner (user or org)"
                            className="w-56 rounded-md border border-gray-300 bg-surface-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600"
                        />
                        <button
                            type="button"
                            disabled={
                                refreshOwnerRepos.isPending || !owner.trim()
                            }
                            onClick={() =>
                                refreshOwnerRepos.mutate({
                                    provider,
                                    owner: owner.trim(),
                                })
                            }
                            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 font-medium text-sm text-text-label transition-colors hover:bg-surface-tertiary disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700"
                        >
                            <RotateCcw
                                className={`h-4 w-4 ${
                                    refreshOwnerRepos.isPending
                                        ? "animate-spin"
                                        : ""
                                }`}
                            />
                            {refreshOwnerRepos.isPending
                                ? "Refreshing..."
                                : "Refresh repos"}
                        </button>
                    </div>
                    {refreshOwnerRepos.error && (
                        <p className="text-red-600 text-xs dark:text-red-400">
                            {refreshOwnerRepos.error.message}
                        </p>
                    )}
                    {refreshOwnerRepos.data && (
                        <p className="text-sm text-text-secondary">
                            {formatResult(refreshOwnerRepos.data)}
                        </p>
                    )}
                </div>
            </section>
        </div>
    );
}
