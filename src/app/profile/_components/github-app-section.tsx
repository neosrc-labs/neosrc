"use client";

import { CircleCheck, ExternalLink } from "lucide-react";
import { installationAccountName } from "~/app/onboarding/_components/onboarding-view";
import { api } from "~/trpc/react";

export function GithubAppSection({
    githubUsername,
    githubAppInstallationUrl,
}: {
    githubUsername: string | null;
    githubAppInstallationUrl: string | null;
}) {
    const { data: installations, isLoading } =
        api.onboarding.getGitHubAppInstallations.useQuery(undefined, {
            enabled: !!githubUsername,
        });

    if (!githubUsername) return null;

    if (isLoading) {
        return (
            <section className="rounded-lg border border-border-subtle p-6">
                <div className="mb-4 h-5 w-24 animate-pulse rounded bg-surface-selected" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-surface-selected" />
            </section>
        );
    }

    return (
        <section className="rounded-lg border border-border-subtle p-6">
            <h2 className="mb-4 text-text-primary">GitHub App</h2>
            {!installations || installations.length === 0 ? (
                <div className="flex flex-col items-start gap-4">
                    {githubAppInstallationUrl && (
                        <>
                            <p className="text-sm text-text-secondary">
                                Install the Neosrc GitHub App to browse your
                                private repositories from Neosrc.
                            </p>
                            <a
                                href={githubAppInstallationUrl}
                                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                            >
                                Install GitHub App
                            </a>
                        </>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    <ul className="space-y-2">
                        {installations.map((installation) => (
                            <li
                                key={installation.id}
                                className="flex items-center justify-between gap-3 text-sm"
                            >
                                <span className="flex min-w-0 items-center gap-2">
                                    <CircleCheck className="h-4 w-4 shrink-0 text-green-600 dark:text-green-500" />
                                    <span className="truncate text-text-primary">
                                        {installationAccountName(installation)}
                                    </span>
                                    <span className="text-text-tertiary text-xs">
                                        {installation.target_type}
                                    </span>
                                    {installation.suspended_at && (
                                        <span className="rounded-full border border-border px-2 py-0.5 text-text-tertiary text-xs">
                                            Suspended
                                        </span>
                                    )}
                                </span>
                                <a
                                    href={`https://github.com/settings/installations/${installation.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex shrink-0 items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                                >
                                    Manage
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </li>
                        ))}
                    </ul>
                    {githubAppInstallationUrl && (
                        <a
                            href={githubAppInstallationUrl}
                            className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                        >
                            Install on another account
                        </a>
                    )}
                </div>
            )}
        </section>
    );
}
