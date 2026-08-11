"use client";

import { CircleCheck, ExternalLink, GitPullRequest } from "lucide-react";
import Link from "next/link";
import type { Installation } from "~/server/github";

import { api } from "~/trpc/react";

export function OnboardingView({ installUrl }: { installUrl: string }) {
    const { data } = api.onboarding.getGitHubAppInstallations.useQuery();

    const installations = data ?? [];

    return (
        <main className="mx-auto flex min-h-[calc(100svh-var(--header-height))] max-w-3xl flex-col px-6 py-16">
            <div className="flex flex-col items-center gap-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 dark:bg-blue-500">
                    <GitPullRequest className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-4xl text-text-primary sm:text-5xl">
                    Bring your private repositories to Neosrc
                </h1>
                <p className="max-w-lg text-lg text-text-secondary">
                    Install the Neosrc GitHub App to allow private repositories.
                    It takes about a minute and you can pick which accounts to
                    grant access.
                </p>
            </div>

            {installations.length > 0 && (
                <ul className="mt-8 space-y-2">
                    {installations.map((installation) => (
                        <li
                            key={installation.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle px-4 py-3 text-sm"
                        >
                            <span className="flex min-w-0 items-center gap-2">
                                <CircleCheck className="h-4 w-4 shrink-0 text-green-600 dark:text-green-500" />
                                <span className="truncate text-text-primary">
                                    {installationAccountName(installation)}
                                </span>
                                <span className="text-text-tertiary text-xs">
                                    {installation.target_type}
                                </span>
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
            )}

            <div className="mt-12 flex flex-col items-center gap-4">
                <a
                    href={installUrl}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                    {installations.length === 0
                        ? "Install GitHub App"
                        : "Manage installations"}
                </a>
                <Link
                    href="/"
                    className="text-sm text-text-primary underline-offset-4 transition hover:text-text-primary hover:underline"
                >
                    {installations.length === 0 ? "Skip for now" : "Continue"}
                </Link>
            </div>
        </main>
    );
}

export function installationAccountName(
    installation: Installation,
): string | null {
    if (!installation.account) {
        return null;
    }

    if (installation.account.name) {
        return installation.account.name;
    }

    if ("login" in installation.account) {
        return installation.account.login;
    }

    return null;
}
