"use client";

import {
    BellOffIcon,
    CheckIcon,
    ChevronDownIcon,
    EyeIcon,
    GitForkIcon,
    StarIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { Async } from "~/components/async";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import type { RepoData } from "./repo-code-page";

interface RepoHeaderProps {
    owner: string;
    repo: string;
    repoDataPromise: Promise<RepoData>;
    starredPromise: Promise<boolean>;
    subscriptionPromise: Promise<{
        subscribed: boolean;
        ignored: boolean;
    } | null>;
}

export function RepoHeader({
    owner,
    repo,
    repoDataPromise,
    starredPromise,
    subscriptionPromise,
}: RepoHeaderProps) {
    return (
        <div className="flex flex-wrap items-center gap-3">
            <h1 className="whitespace-nowrap text-text-primary text-xl">
                <span className="text-text-tertiary">{owner}</span>
                <span className="text-text-tertiary"> / </span>
                <span className="font-semibold">{repo}</span>
            </h1>

            <Async
                promise={combine(
                    repoDataPromise,
                    starredPromise,
                    subscriptionPromise,
                )}
                fallback={<HeaderActionsSkeleton />}
            >
                {([repoData, starred, subscription]) => (
                    <>
                        {repoData.ownerAvatarUrl && (
                            <img
                                src={repoData.ownerAvatarUrl}
                                alt=""
                                className="size-6 rounded-full"
                            />
                        )}
                        <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 font-medium text-text-tertiary text-xs">
                            {repoData.isPrivate ? "Private" : "Public"}
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                            <WatchDropdown
                                owner={owner}
                                repo={repo}
                                watchers={repoData.watchers}
                                initialSubscription={subscription}
                            />
                            <ForkButton
                                owner={owner}
                                repo={repo}
                                forks={repoData.forks}
                            />
                            <StarButton
                                owner={owner}
                                repo={repo}
                                stars={repoData.stars}
                                initialStarred={starred}
                            />
                        </div>
                    </>
                )}
            </Async>
        </div>
    );
}

function combine<A, B, C>(
    a: Promise<A>,
    b: Promise<B>,
    c: Promise<C>,
): Promise<[A, B, C]> {
    return Promise.all([a, b, c]);
}

function HeaderActionsSkeleton() {
    return (
        <>
            <div className="size-6 animate-pulse rounded-full bg-surface-secondary" />
            <div className="h-5 w-14 animate-pulse rounded-full bg-surface-secondary" />
            <div className="ml-auto flex items-center gap-2">
                <div className="h-8 w-[5.25rem] animate-pulse rounded-lg bg-surface-secondary" />
                <div className="h-8 w-[4.5rem] animate-pulse rounded-lg bg-surface-secondary" />
                <div className="h-8 w-16 animate-pulse rounded-lg bg-surface-secondary" />
            </div>
        </>
    );
}

// ---------------------------------------------------------------------------
// Watch dropdown
// ---------------------------------------------------------------------------

interface SubscriptionState {
    subscribed: boolean;
    ignored: boolean;
}

function WatchDropdown({
    owner,
    repo,
    watchers,
    initialSubscription,
}: {
    owner: string;
    repo: string;
    watchers: number;
    initialSubscription: SubscriptionState | null;
}) {
    const [open, setOpen] = useState(false);
    const [subscription, setSubscription] = useState(initialSubscription);
    const confirmed = useRef(initialSubscription);
    const utils = api.useUtils();

    const setSub = api.repos.setSubscription.useMutation({
        onMutate: ({ subscribed, ignored }) => {
            confirmed.current = subscription;
            setSubscription({ subscribed, ignored });
        },
        onError: () => {
            setSubscription(confirmed.current);
        },
        onSettled: () => {
            utils.repos.getSubscription.invalidate({ owner, repo });
        },
    });

    const deleteSub = api.repos.deleteSubscription.useMutation({
        onMutate: () => {
            confirmed.current = subscription;
            setSubscription(null);
        },
        onError: () => {
            setSubscription(confirmed.current);
        },
        onSettled: () => {
            utils.repos.getSubscription.invalidate({ owner, repo });
        },
    });

    const isWatching =
        !!subscription && subscription.subscribed && !subscription.ignored;
    const isIgnoring = !!subscription && subscription.ignored;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition",
                        isWatching
                            ? "border-border bg-surface-secondary text-text-primary"
                            : "border-border bg-surface text-text-secondary hover:bg-surface-secondary",
                    )}
                >
                    {isIgnoring ? (
                        <BellOffIcon className="h-3.5 w-3.5" />
                    ) : (
                        <EyeIcon className="h-3.5 w-3.5" />
                    )}
                    <span>
                        {isIgnoring
                            ? "Stop ignoring"
                            : isWatching
                              ? "Watching"
                              : "Watch"}
                    </span>
                    <span className="font-semibold text-text-primary">
                        {formatCount(watchers)}
                    </span>
                    <ChevronDownIcon className="h-3 w-3 text-text-tertiary" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
                <div className="py-1">
                    <WatchOption
                        label="Participating and @mentions"
                        description="Only receive notifications from threads you participated in or @mentioned"
                        selected={subscription === null}
                        onClick={() => {
                            deleteSub.mutate({
                                owner,
                                repo,
                            });
                            setOpen(false);
                        }}
                    />
                    <WatchOption
                        label="All Activity"
                        description="Receive notifications for all conversations"
                        selected={isWatching}
                        onClick={() => {
                            setSub.mutate({
                                owner,
                                repo,
                                subscribed: true,
                                ignored: false,
                            });
                            setOpen(false);
                        }}
                    />
                    <WatchOption
                        label="Ignore"
                        description="Never be notified"
                        selected={isIgnoring}
                        onClick={() => {
                            setSub.mutate({
                                owner,
                                repo,
                                subscribed: false,
                                ignored: true,
                            });
                            setOpen(false);
                        }}
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
}

function WatchOption({
    label,
    description,
    selected,
    onClick,
    href,
}: {
    label: string;
    description: string;
    selected: boolean;
    onClick?: () => void;
    href?: string;
}) {
    const content = (
        <div className="flex items-start gap-2 px-3 py-2">
            <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                {selected && (
                    <CheckIcon className="h-3.5 w-3.5 text-text-label" />
                )}
            </div>
            <div>
                <p className="font-medium text-sm text-text-primary">{label}</p>
                <p className="text-text-tertiary text-xs">{description}</p>
            </div>
        </div>
    );

    if (href) {
        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="block cursor-pointer transition-colors hover:bg-surface-secondary"
            >
                {content}
            </a>
        );
    }

    return (
        <button
            type="button"
            className="block w-full cursor-pointer text-left transition-colors hover:bg-surface-secondary"
            onClick={onClick}
        >
            {content}
        </button>
    );
}

// ---------------------------------------------------------------------------
// Star button
// ---------------------------------------------------------------------------

function StarButton({
    owner,
    repo,
    stars,
    initialStarred,
}: {
    owner: string;
    repo: string;
    stars: number;
    initialStarred: boolean;
}) {
    const [starred, setStarred] = useState(initialStarred);
    const [count, setCount] = useState(stars);
    const [pending, setPending] = useState(false);
    const confirmed = useRef({ starred, count });
    const utils = api.useUtils();

    const starMutation = api.repos.star.useMutation({
        onMutate: () => {
            confirmed.current = { starred, count };
            setStarred(true);
            setCount((c) => c + 1);
            setPending(true);
        },
        onError: () => {
            setStarred(confirmed.current.starred);
            setCount(confirmed.current.count);
            setPending(false);
        },
        onSettled: () => {
            setPending(false);
            utils.repos.getStarred.invalidate({ owner, repo });
        },
    });

    const unstarMutation = api.repos.unstar.useMutation({
        onMutate: () => {
            confirmed.current = { starred, count };
            setStarred(false);
            setCount((c) => c - 1);
            setPending(true);
        },
        onError: () => {
            setStarred(confirmed.current.starred);
            setCount(confirmed.current.count);
            setPending(false);
        },
        onSettled: () => {
            setPending(false);
            utils.repos.getStarred.invalidate({ owner, repo });
        },
    });

    const handleClick = () => {
        if (pending) return;
        if (starred) {
            unstarMutation.mutate({ owner, repo });
        } else {
            starMutation.mutate({ owner, repo });
        }
    };

    return (
        <button
            type="button"
            className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition",
                "border-border bg-surface text-text-secondary hover:bg-surface-secondary",
                pending && "cursor-wait opacity-70",
            )}
            onClick={handleClick}
            disabled={pending}
        >
            <StarIcon
                className={cn(
                    "h-3.5 w-3.5",
                    starred && "fill-[#e3b341] stroke-[#e3b341]",
                )}
            />
            <span className="font-semibold text-text-primary">
                {formatCount(count)}
            </span>
            <span>{starred ? "Starred" : "Star"}</span>
        </button>
    );
}

// ---------------------------------------------------------------------------
// Fork button
// ---------------------------------------------------------------------------

function ForkButton({
    owner,
    repo,
    forks,
}: {
    owner: string;
    repo: string;
    forks: number;
}) {
    return (
        <a
            href={`https://github.com/${owner}/${repo}/fork`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-text-secondary text-xs transition hover:bg-surface-secondary"
        >
            <GitForkIcon className="h-3.5 w-3.5" />
            <span className="font-semibold text-text-primary">
                {formatCount(forks)}
            </span>
            <span>Fork</span>
        </a>
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCount(count: number): string {
    if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}k`;
    }
    return String(count);
}
