"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { UserLink } from "~/components/user-link";
import type {
    GQLMergeQueueEntry,
    GQLMergeQueueEntryState,
    GQLReactionNode,
} from "~/server/github-graphql";
import { api } from "~/trpc/react";
import {
    canInteract,
    type PullRequestPermissionContext,
} from "../../permissions-utils";
import { CommentForm } from "../comment-form";
import { TimelineEvent } from "./event";
import { RevertedBanner, type RevertedByEntry } from "./reverted-banner";
import { aggregateEvents, filterTimelineEvents } from "./utils";

export function TimelineSkeleton() {
    const items = [
        { key: "w-24", text: "w-48", body: true },
        { key: "w-20", text: "w-36", body: false },
        { key: "w-28", text: "w-56", body: true },
    ];
    return (
        <div className="relative">
            <div className="absolute top-0 bottom-0 left-6 w-px bg-surface-selected" />
            <div className="space-y-6 pl-14">
                {items.map((item) => (
                    <div key={item.key}>
                        <div className="flex items-center gap-2">
                            <div
                                className="h-2.5 animate-pulse rounded bg-surface-selected"
                                style={{ width: "40px" }}
                            />
                            <div
                                className={`h-4 animate-pulse rounded bg-surface-selected ${item.text}`}
                            />
                        </div>
                        {item.body && (
                            <div className="mt-2 space-y-1.5">
                                <div className="h-3.5 w-full animate-pulse rounded bg-surface-tertiary" />
                                <div className="h-3.5 w-3/4 animate-pulse rounded bg-surface-tertiary" />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

interface TimelineSectionProps {
    owner: string;
    repo: string;
    number: number;
    permissionContext: PullRequestPermissionContext;
}

export function TimelineSection({
    owner,
    repo,
    number,
    permissionContext,
}: TimelineSectionProps) {
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
        api.timeline.list.useInfiniteQuery(
            { owner, repo, number, limit: 100 },
            {
                getNextPageParam: (lastPage) => lastPage.nextCursor,
            },
        );

    useEffect(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const { data: allComments = [] } = api.reviewComments.list.useQuery(
        { owner, repo, number },
        { staleTime: 30_000 },
    );

    const allEvents = useMemo(
        () => data?.pages.flatMap((page) => page.events) ?? [],
        [data],
    );
    const allCommentReactions = useMemo(
        () =>
            data?.pages.reduce<Record<number, GQLReactionNode[]>>(
                (acc, page) => {
                    for (const [id, reactions] of Object.entries(
                        page.commentReactions,
                    )) {
                        acc[Number(id)] = reactions;
                    }
                    return acc;
                },
                {} as Record<number, GQLReactionNode[]>,
            ) ?? {},
        [data],
    );

    const searchParams = useSearchParams();
    const timelineRouter = useRouter();
    const timelineEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (searchParams.get("scrollTo") !== "bottom") return;
        if (!data) return;

        const timer = setTimeout(() => {
            timelineEndRef.current?.scrollIntoView({ behavior: "smooth" });
            const params = new URLSearchParams(searchParams.toString());
            params.delete("scrollTo");
            const newParams = params.toString();
            timelineRouter.replace(
                `/gh/${owner}/${repo}/pull/${number}${newParams ? `?${newParams}` : ""}`,
                { scroll: false },
            );
        }, 100);

        return () => clearTimeout(timer);
    }, [searchParams, data, owner, repo, number, timelineRouter]);

    const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
        null,
    );
    const adjustIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
        null,
    );
    const handledHashRef = useRef<string | null>(null);

    useEffect(() => {
        if (!data) return;

        const scrollToHash = () => {
            const hash = window.location.hash;
            if (!hash) return;
            const targetId = hash.slice(1);
            if (!/^(issuecomment|pullrequestreview)-\d+$/.test(targetId)) {
                return;
            }

            if (handledHashRef.current === targetId) return;
            handledHashRef.current = targetId;

            if (adjustIntervalRef.current) {
                clearInterval(adjustIntervalRef.current);
                adjustIntervalRef.current = null;
            }

            if (scrollIntervalRef.current) {
                clearInterval(scrollIntervalRef.current);
            }

            scrollIntervalRef.current = setInterval(() => {
                const el = document.getElementById(targetId);
                if (el) {
                    if (scrollIntervalRef.current) {
                        clearInterval(scrollIntervalRef.current);
                        scrollIntervalRef.current = null;
                    }
                    el.classList.add("comment-highlight");

                    const scrollToTarget = () => {
                        const rect = el.getBoundingClientRect();
                        window.scrollTo({
                            top:
                                rect.top +
                                window.scrollY -
                                window.innerHeight * 0.3,
                        });
                    };

                    requestAnimationFrame(() => {
                        requestAnimationFrame(scrollToTarget);
                    });

                    let adjustCount = 0;
                    adjustIntervalRef.current = setInterval(() => {
                        const rect = el.getBoundingClientRect();
                        const drift = rect.top - window.innerHeight * 0.3;
                        if (Math.abs(drift) > 30) {
                            window.scrollBy({
                                top: drift,
                            });
                        }
                        adjustCount++;
                        if (adjustCount >= 15) {
                            if (adjustIntervalRef.current) {
                                clearInterval(adjustIntervalRef.current);
                                adjustIntervalRef.current = null;
                            }
                        }
                    }, 300);
                }
            }, 200);
        };

        scrollToHash();
        window.addEventListener("hashchange", scrollToHash);
        return () => {
            window.removeEventListener("hashchange", scrollToHash);
            if (scrollIntervalRef.current) {
                clearInterval(scrollIntervalRef.current);
                scrollIntervalRef.current = null;
            }
            if (adjustIntervalRef.current) {
                clearInterval(adjustIntervalRef.current);
                adjustIntervalRef.current = null;
            }
        };
    }, [data]);

    const STATE_LABELS: Record<GQLMergeQueueEntryState, string> = {
        QUEUED: "In queue",
        AWAITING_CHECKS: "Awaiting checks",
        MERGEABLE: "Mergeable",
        UNMERGEABLE: "Unmergeable",
        LOCKED: "Locked",
    };

    const STATE_COLORS: Record<
        GQLMergeQueueEntryState,
        { bg: string; text: string; dot: string }
    > = {
        QUEUED: {
            bg: "bg-state-queued/10 border-state-queued/25 dark:bg-state-queued/20 dark:border-state-queued/40",
            text: "text-state-queued",
            dot: "bg-state-queued",
        },
        AWAITING_CHECKS: {
            bg: "bg-state-queued/10 border-state-queued/25 dark:bg-state-queued/20 dark:border-state-queued/40",
            text: "text-state-queued",
            dot: "bg-state-queued",
        },
        MERGEABLE: {
            bg: "bg-state-open/10 border-state-open/25 dark:bg-state-open/20 dark:border-state-open/40",
            text: "text-state-open",
            dot: "bg-state-open",
        },
        UNMERGEABLE: {
            bg: "bg-state-closed/10 border-state-closed/25 dark:bg-state-closed/20 dark:border-state-closed/40",
            text: "text-state-closed",
            dot: "bg-state-closed",
        },
        LOCKED: {
            bg: "bg-surface-secondary border-border /30",
            text: "text-text-secondary",
            dot: "bg-gray-400",
        },
    };

    function MergeQueueBanner({
        entry,
    }: {
        entry: NonNullable<GQLMergeQueueEntry>;
    }) {
        const colors = STATE_COLORS[entry.state];
        const label = STATE_LABELS[entry.state];

        return (
            <div className={`mb-4 rounded-lg border px-4 py-3 ${colors.bg}`}>
                <div className="flex items-center gap-2">
                    <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${colors.dot}`}
                    />
                    <span className={`font-medium text-sm ${colors.text}`}>
                        {`#${entry.position} in merge queue`}
                    </span>
                    <span
                        className={`rounded-full px-2 py-0.5 font-medium text-xs ${colors.bg} ${colors.text}`}
                    >
                        {label}
                    </span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-text-tertiary text-xs">
                    <UserLink actor={entry.enqueuer} />
                    <span>queued this PR</span>
                    {entry.headCommit && (
                        <span className="font-mono">
                            {entry.headCommit.oid.slice(0, 7)}
                        </span>
                    )}
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="mt-5">
                <TimelineSkeleton />
            </div>
        );
    }

    const mergeQueueEntry = data?.pages[0]?.mergeQueueEntry ?? null;
    const filteredEvents = filterTimelineEvents(allEvents);

    const revertedBy = (() => {
        const revertRe = /^Reverts\s+([\w.-]+\/[\w.-]+)#(\d+)\b/i;
        const found = new Map<number, RevertedByEntry>();
        for (const ev of filteredEvents) {
            if (ev.__typename !== "CrossReferencedEvent") continue;
            const source = ev.source;
            if (source?.__typename !== "PullRequest") continue;
            const match = source.body?.match(revertRe);
            if (!match) continue;
            const refRepo = match[1];
            const refNum = Number(match[2]);
            if (refNum !== number) continue;
            if (refRepo !== `${owner}/${repo}`) continue;
            const srcOwner = source.repository.owner.login;
            const srcRepoName = source.repository.name;
            if (`${srcOwner}/${srcRepoName}` !== `${owner}/${repo}`) continue;
            if (found.has(source.number)) continue;
            found.set(source.number, {
                number: source.number,
                title: source.title,
                url: source.url,
                owner: srcOwner,
                repo: srcRepoName,
                state: source.state,
            });
        }
        return [...found.values()];
    })();

    const wrappers = aggregateEvents(filteredEvents);

    return (
        <div className="mt-5">
            {mergeQueueEntry && <MergeQueueBanner entry={mergeQueueEntry} />}

            {revertedBy.map((revert) => (
                <RevertedBanner key={revert.number} revert={revert} />
            ))}

            {wrappers.length === 0 && (
                <p className="text-sm text-text-tertiary">
                    No timeline events yet.
                </p>
            )}

            <div className="relative">
                <div className="absolute top-0 bottom-0 left-6 w-px bg-surface-selected" />

                {wrappers.map((wrapper) => (
                    <TimelineEvent
                        key={
                            wrapper.type === "raw"
                                ? `raw-${wrapper.event.id}`
                                : `label-${wrapper.createdAt}`
                        }
                        wrapper={wrapper}
                        number={number}
                        owner={owner}
                        repo={repo}
                        commentReactions={allCommentReactions}
                        allComments={allComments}
                        permissionContext={permissionContext}
                    />
                ))}
            </div>

            {isFetchingNextPage && (
                <div className="py-4 text-center">
                    <p className="text-sm text-text-tertiary">
                        Loading more...
                    </p>
                </div>
            )}

            <div ref={timelineEndRef}>
                <CommentForm
                    disabled={!canInteract(permissionContext)}
                    number={number}
                    owner={owner}
                    repo={repo}
                />
            </div>
        </div>
    );
}
