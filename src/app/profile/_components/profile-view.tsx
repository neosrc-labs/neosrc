"use client";

import {
    Building2,
    CalendarDays,
    Link as LinkIcon,
    MapPin,
} from "lucide-react";

import { AccountManager } from "~/app/_components/account-manager";
import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/utils";

function ProviderProfileCard({
    provider,
    username,
}: {
    provider: "gh" | "cb";
    username: string;
}) {
    const { data, isLoading } = api.users.getByUsername.useQuery(
        { provider, username },
        { staleTime: 5 * 60 * 1000 },
    );

    const user = data?.user;

    const profileUrl =
        provider === "cb"
            ? `https://codeberg.org/${username}`
            : `https://github.com/${username}`;

    if (isLoading) {
        return (
            <section className="rounded-lg border border-border-subtle p-6">
                <div className="mb-4 h-5 w-32 animate-pulse rounded bg-surface-selected" />
                <div className="flex animate-pulse items-start gap-4">
                    <div className="h-16 w-16 shrink-0 rounded-full bg-surface-selected" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 w-40 rounded bg-surface-selected" />
                        <div className="h-3 w-24 rounded bg-surface-selected" />
                    </div>
                </div>
            </section>
        );
    }

    if (!user) {
        return (
            <section className="rounded-lg border border-border-subtle p-6">
                <SectionHeading provider={provider} />
                <p className="text-sm text-text-tertiary">
                    Could not load profile information.
                </p>
            </section>
        );
    }

    return (
        <section className="rounded-lg border border-border-subtle p-6">
            <SectionHeading provider={provider} />
            <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4">
                    <img
                        alt={user.login}
                        className="h-16 w-16 rounded-full"
                        src={user.avatar_url}
                    />
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                            {user.name && (
                                <a
                                    className="font-semibold text-base text-text-primary hover:underline"
                                    href={profileUrl}
                                    rel="noreferrer"
                                    target="_blank"
                                >
                                    {user.name}
                                </a>
                            )}
                            <span className="text-sm text-text-tertiary">
                                {user.login}
                            </span>
                        </div>
                        {user.bio && (
                            <p className="mt-1 text-sm text-text-secondary leading-relaxed">
                                {user.bio}
                            </p>
                        )}
                        <div className="mt-2 flex items-center gap-3 text-text-secondary text-xs">
                            <span>
                                <strong className="font-semibold text-text-primary">
                                    {(user.followers ?? 0).toLocaleString()}
                                </strong>{" "}
                                followers
                            </span>
                            <span>
                                <strong className="font-semibold text-text-primary">
                                    {(user.following ?? 0).toLocaleString()}
                                </strong>{" "}
                                following
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-text-secondary text-xs">
                    {user.company && (
                        <span className="inline-flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 shrink-0" />
                            {user.company}
                        </span>
                    )}
                    {user.location && (
                        <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            {user.location}
                        </span>
                    )}
                    {user.blog && (
                        <span className="inline-flex items-center gap-1.5">
                            <LinkIcon className="h-3.5 w-3.5 shrink-0" />
                            <a
                                className="truncate text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400"
                                href={
                                    user.blog.startsWith("http")
                                        ? user.blog
                                        : `https://${user.blog}`
                                }
                                rel="noreferrer"
                                target="_blank"
                            >
                                {user.blog.replace(/^https?:\/\//, "")}
                            </a>
                        </span>
                    )}
                    {user.created_at && (
                        <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                            Joined {formatRelativeTime(user.created_at)}
                        </span>
                    )}
                </div>
            </div>
        </section>
    );
}

function SectionHeading({ provider }: { provider: "gh" | "cb" }) {
    return (
        <h2 className="mb-4 text-text-primary">
            {provider === "cb" ? "Codeberg" : "GitHub"}
        </h2>
    );
}

export function ProfileView({
    name,
    image,
    githubUsername,
    codebergUsername,
}: {
    name: string;
    image: string | null;
    githubUsername: string | null;
    codebergUsername: string | null;
}) {
    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center gap-5">
                {image ? (
                    <img
                        alt={name}
                        className="h-16 w-16 rounded-full"
                        src={image}
                    />
                ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-selected text-text-tertiary text-xl">
                        {name.charAt(0).toUpperCase()}
                    </div>
                )}
                <div>
                    <h1 className="text-text-primary">{name}</h1>
                </div>
            </div>

            <div className="flex flex-col gap-6">
                {githubUsername && (
                    <ProviderProfileCard
                        provider="gh"
                        username={githubUsername}
                    />
                )}
                {codebergUsername && (
                    <ProviderProfileCard
                        provider="cb"
                        username={codebergUsername}
                    />
                )}
                {!githubUsername && !codebergUsername && (
                    <p className="text-sm text-text-tertiary">
                        No accounts linked yet. Use the section below to connect
                        GitHub or Codeberg.
                    </p>
                )}
            </div>

            <section>
                <h2 className="mb-4 text-text-primary">Linked Accounts</h2>
                <AccountManager
                    githubUsername={githubUsername}
                    codebergUsername={codebergUsername}
                />
            </section>
        </div>
    );
}
